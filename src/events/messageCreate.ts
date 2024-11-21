import { DMChannel, EmbedBuilder, Events, Guild, GuildBasedChannel, GuildMember, Message, PublicThreadChannel, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { COLORS, DISBOARD_UID, EMOJIS, getChannelFromEnv, getForumIdsFromEnv, getRoleFromEnv } from "../utils/constants.ts";
import { applyTimeout } from "../commands/moderation/timeout.ts";
import { Users } from "../Models/User.ts";
import { getCooldown, setCooldown } from "../utils/cooldowns.ts";
import { checkRole, convertMsToUnixTimestamp } from "../utils/generic.ts";
import { checkHelp } from "../utils/checkhelp.ts";
import { bumpHandler } from "../utils/bumpHandler.ts";
import natural from "natural";

const PREFIX = "!"; // Define tu prefijo

export default {
	name: Events.MessageCreate,
	async execute(message: Message) {
		if (
			message.author.id === DISBOARD_UID &&
			message.embeds.length &&
			message.embeds[0].data.color == COLORS.lightSeaGreen &&
			message.embeds[0].data.description?.includes(EMOJIS.thumbsUp)
		) {
			return bumpHandler(message.client as ExtendedClient, message);
		}
		// Evita mensajes de bots o mensajes que no tengan el prefijo
		if (message.author.bot || message.author.system) return;
		const client = message.client as ExtendedClient;

		if (!message.inGuild()) {
			return await (message.channel as DMChannel).send({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.pyeLightBlue) // Puedes elegir el color que prefieras
						.setTitle("¡Hola! 👋")
						.setDescription(
							`Actualmente, **no soportamos comandos** a través de **mensajes directos**.\n\n` +
								`Si te encuentras **baneado** o **silenciado** en nuestro servidor, puedes **apelar** en el siguiente enlace:\n` +
								`👉 [Apela aquí](https://discord.gg/F8QxEMtJ3B)`
						)
						.setThumbnail(client.user?.displayAvatarURL() ?? "")
						.setTimestamp()
						.setFooter({ text: "Gracias por entender y por ser parte de nuestra comunidad." }),
				],
			});
		}

		if (message.channel.id !== getChannelFromEnv("logs")) {
			await spamFilter(message, client);
		}

		if (!message.content.startsWith(PREFIX)) {
			if (![getChannelFromEnv("mudae"), getChannelFromEnv("casinoPye")].includes(message.channel.id)) {
				const moneyConfig = (message.client as ExtendedClient).getMoneyConfig(process.env.CLIENT_ID ?? "");
				getCooldown(message.client as ExtendedClient, message.author.id, "farm-text", moneyConfig.text.time).then(async (time) => {
					if (time > 0) {
						Users.findOneAndUpdate({ id: message.author.id }, { $inc: { cash: moneyConfig.text.coins } }, { upsert: true })
							.exec()
							.then(() => {
								setCooldown(message.client as ExtendedClient, message.author.id, "farm-text", moneyConfig.text.time);
							});
					}
				});

				specificChannels(message, client);
				checkChannel(message).then((isThankable) => {
					if (isThankable) {
						checkHelp(message);
					}
				});
			}
		} else {
			const commandBody = message.content.slice(PREFIX.length).trim();
			const commandName = commandBody.split(/ +/, 1).shift()?.toLowerCase() ?? "";
			const commandArgs = commandBody.slice(commandName.length).trim();

			// Verifica si el comando existe en la colección de comandos
			const command = client.commands.get(commandName);

			if (!command) {
				message.reply("Ese comando no existe.");
				return;
			}

			try {
				if (command.executePrefix) {
					await command.executePrefix(message, commandArgs);
				} else {
					message.reply("Este comando no soporta prefijos.");
				}
			} catch (error) {
				console.error(`Error ejecutando el comando ${commandName}:`, error);
				message.reply("Hubo un error ejecutando ese comando.");
			}
		}
	},
};

export interface IFilter {
	filter: RegExp;
	mute: boolean;
	staffWarn?: string;
}

const linkPeligroso = "Posible link peligroso detectado";
const filterList: IFilter[] = [
	{ filter: /\w+\.xyz$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.click$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.info$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.ru$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.biz$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.online$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.club$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /^(https?:\/\/)?t\.me\/.+$/i, mute: true },
	{ filter: /^(https?:\/\/)?telegram\.me\/.+$/i, mute: true },
	{ filter: /^(https?:\/\/)?wa\.me\/.+$/i, mute: true },
	{ filter: /^(https?:\/\/)?whatsapp\.me\/.+$/i, mute: true },
	{
		filter: /^(?!(https?:\/\/)?discord\.gg\/programacion$)(https?:\/\/)?discord\.gg\/.+$/i,
		mute: true,
	},
	{
		filter: /^(?!(https?:\/\/)?discord\.com\/invite\/programacion$)(https?:\/\/)?discord\.com\/invite\/.+$/i,
		mute: true,
	},
	{ filter: /^(https?:\/\/)?steamcommunity\.com\/gift\/.+$/i, mute: false },
	{
		filter: /(?=.*(?:eth|ethereum|btc|bitcoin|capital|crypto|memecoins))(?=.*\b(?:gana\w*|gratis|multiplica\w*|inver\w*)\b).*/is,
		mute: false,
		staffWarn: "Posible estafa detectada",
	},
];
async function spamFilter(message: Message<boolean>, client: ExtendedClient) {
	if (message.content?.length < 8) return;

	if ((message.mentions.members?.size ?? 0) > 0) checkMentionSpam(message, client);

	const detectedFilter = filterList.find((item) => item.filter.test(message.content));

	if (detectedFilter && !detectedFilter.staffWarn) {
		try {
			await message.delete();
			if (detectedFilter.mute)
				applyTimeout(
					10000,
					"Spam Filter",
					message.member as GuildMember,
					message.guild?.iconURL({ extension: "gif" }) ?? null,
					message.author
				);
			console.log("Mensaje borrado que contenía texto en la black list");
		} catch (error) {
			console.error("spamFilter: Error al intentar borrar el mensaje:", error);
		}

		const logChannel = (client.channels.cache.get(getChannelFromEnv("logs")) ??
			client.channels.resolve(getChannelFromEnv("logs"))) as TextChannel | null;

		await logChannel
			?.send({
				content: `##spamFilter: \nSe eliminó un mensaje que contenía texto no permitido.\n${message.author}(${message.author.id}) - ${message.channel} \n **spam triggered** : \`${detectedFilter.filter}\``,
			})
			.catch((err) => console.warn("spamFilter: Error al intentar enviar el log.", err));
	} else if (detectedFilter?.staffWarn) {
		const moderatorChannel = (client.channels.cache.get(getChannelFromEnv("moderadores")) ??
			client.channels.resolve(getChannelFromEnv("moderadores"))) as TextChannel | null;
		const messageLink = `https://discord.com/channels/${message.guild?.id}/${message.channel.id}/${message.id}`;
		await moderatorChannel
			?.send({
				content: `**Advertencia:** ${detectedFilter.staffWarn}. ${messageLink}`,
			})
			.catch((err) => console.error("spamFilter: Error al enviar el mensaje de advertencia:", err));
	}
}
const mentionTracker = new Map();
async function checkMentionSpam(message: Message<boolean>, client: ExtendedClient) {
	const mentionedUsers = message.mentions.users;
	const authorId = message.author.id;

	mentionedUsers.forEach(async (mentionedUser) => {
		const mentionedId = mentionedUser.id;
		const key = `${authorId}-${mentionedId}`;

		if (!mentionTracker.has(key)) {
			mentionTracker.set(key, {
				count: 1,
				timeout: setTimeout(() => {
					mentionTracker.delete(key);
				}, 5000),
			});
		} else {
			const entry = mentionTracker.get(key);
			entry.count += 1;

			if (entry.count >= 3) {
				clearTimeout(entry.timeout);
				let warn = await (message.channel as TextChannel).send({
					content: `<@${message.author.id}> Mencionar tanto a una misma persona puede traerte problemas. No seas bot, que para eso estoy yo!`,
				});
				await client.guilds.cache
					.get(process.env.GUILD_ID ?? "")
					?.members.cache.get(message.author.id)
					?.timeout(10000, "Spam de menciones")
					.catch(() => null);
				await message.delete().catch(() => null);
				mentionTracker.set(key, {
					count: entry.count,
					timeout: setTimeout(() => {
						mentionTracker.delete(key);
					}, 5000),
				});

				setTimeout(() => warn.delete().catch(() => null), 10000);
			}
		}
	});
}

async function specificChannels(msg: Message<boolean>, client: ExtendedClient) {
	switch (msg.channel.id) {
		case getChannelFromEnv("recursos"):
			msg.react("💤").catch(() => null);
			msg.react("♻").catch(() => null);
			msg.react("922955890200576001").catch(() => null);
			msg.react("796227219591921704").catch(() => null);
			msg.startThread({ name: `${msg.author.username}'s Thread` });
			checkRole(msg, getRoleFromEnv("granAportador"), 50);
			break;
		case getChannelFromEnv("ofreceServicios"):
		case getChannelFromEnv("proyectosNoPagos"): {
			let cooldown = await checkCooldownComparte(msg, client);
			if (cooldown) {
				await (msg.channel as TextChannel).send({
					content: `🚫 <@${
						msg.author.id
					}>Por favor, espera 1 semana entre publicaciónes similares en los canales de compartir. (Tiempo restante: <t:${convertMsToUnixTimestamp(
						cooldown
					)}:R>)`,
				});
				await msg.delete();
			} else {
				client.agregarCompartePost(msg.author.id, msg.channel.id, msg.id);
				msg.startThread({ name: `${msg.author.username}'s Thread` }).then((thread) => {
					thread.send({
						embeds: [
							new EmbedBuilder()
								.setTitle("¡Evita que te estafen!")
								.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" }))
								.setDescription(
									"Por favor te __recordamos__ tomar todas las precauciones posibles al interactuar en estos canales ya que el staff no puede **intervenir** con estafas. **SOLAMENTE TÚ PUEDES EVITAR SER VÍCTIMA DE UNA ESTAFA.**"
								),
							new EmbedBuilder()
								.setTitle("Recomendaciones")
								.setDescription(
									"• No pagues ni entregues ningún trabajo y/o servicio en su totalidad hasta estar completamente seguro que la otra persona es confiable.\n • Si la publicación no ofrece muchos datos al respecto, debes dudar de la misma o bien puedes reportarla a un moderador.\n• Si tienes pruebas sobre la conducta cuestionable de un usuario, puedes reportarlo para impedirle el acceso a estos canales.\n\nDesde este servidor nos comprometemos a mantener estos canales lo más seguros y ordenados dentro de lo posible, **sin embargo** nuestro rol principal es el de brindar un lugar para que los usuarios puedan visibilizar sus publicaciones. Muchas resoluciones de conflicto *exceden* nuestro alcance y obligaciones, por eso recomendamos encarecidamente tener precaución.\n¡En nombre del Staff agradecemos tu atención!"
								)
								.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" })),
						],
					});
				});
				await setCooldown(client, msg.author.id, "comparte-post", 1000 * 60 * 60 * 24 * 7);
			}
			break;
		}
		case getChannelFromEnv("ofertasDeEmpleos"): {
			let cooldown = await checkCooldownComparte(msg, client);
			if (cooldown) {
				(msg.channel as TextChannel).send({
					content: `🚫 <@${
						msg.author.id
					}>Por favor, espera 1 semana entre publicaciónes similares en los canales de compartir. (Tiempo restante: <t:${convertMsToUnixTimestamp(
						cooldown
					)}:R>)`,
				});
				await msg.delete();
			} else {
				client.agregarCompartePost(msg.author.id, msg.channel.id, msg.id);
				msg.startThread({ name: `${msg.author.username}'s Thread` }).then((thread) => {
					thread.send({
						content: `Hey ${msg.author.toString()}!`,
						embeds: [
							new EmbedBuilder()
								.setTitle("Protege tu dinero y asegurate de que tu trabajo sea finalizado")
								.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" }))
								.setDescription(
									"Prueba con nuestra opción <#1099082604252241920>.\nEl servidor se asegurará de que consigas alguien para realizarlo y de resguardar tu dinero hasta que el trabajo finalice."
								),
						],
					});
				});
				await setCooldown(client, msg.author.id, "comparte-post", 1000 * 60 * 60 * 24 * 7);
			}
			break;
		}
		case getChannelFromEnv("memes"):
			msg.react("👍").catch(() => null);
			msg.react("👎").catch(() => null);
			msg.react("⭐").catch(() => null);
			checkRole(msg, getRoleFromEnv("especialistaEnMemes"), 75);
			break;
		case getChannelFromEnv("filosofiaPolitica"):
			checkRole(msg, getRoleFromEnv("granDebatidor"), 500);
			break;
	}
}

/** Check channels to trigger Point Helper system */
async function checkChannel(msg: Message<boolean>) {
	let channel: GuildBasedChannel | TextChannel;
	if (msg.channel.type === 11) {
		channel = (msg.guild as Guild).channels.resolve((msg.channel as PublicThreadChannel).parentId ?? "") as GuildBasedChannel;
		const threadAuthor = await (msg.channel as PublicThreadChannel).fetchOwner();
		if (threadAuthor?.id !== msg.author.id) return false;
	} else channel = msg.channel as TextChannel;
	return getForumIdsFromEnv().includes(channel.id ?? "");
}

async function checkCooldownComparte(msg: Message<boolean>, client: ExtendedClient) {
	let lastPosts = ExtendedClient.ultimosCompartePosts
		.get(msg.author.id)
		?.filter((post) => post.date.getTime() + 1000 * 60 * 60 * 24 * 7 >= Date.now());

	if (!lastPosts) return;
	for (const post of lastPosts) {
		const channel = (client.channels.cache.get(post.channelId) ?? client.channels.resolve(post.channelId)) as TextChannel;
		const message = await channel.messages.fetch(post.messageId);
		let distance = natural.JaroWinklerDistance(message.content, msg.content, { ignoreCase: true });
		console.log(distance, post);
		if (distance > 0.9) {
			return post.date.getTime() + 1000 * 60 * 60 * 24 * 7 - Date.now();
		}
		if (distance > 0.75) {
			const moderatorChannel = (client.channels.cache.get(getChannelFromEnv("moderadores")) ??
				client.channels.resolve(getChannelFromEnv("moderadores"))) as TextChannel;
			if (!moderatorChannel) console.error("spamFilter: No se encontró el canal de moderadores.");
			const oldMessageLink = `https://discord.com/channels/${process.env.GUILD_ID}/${post.channelId}/${post.messageId}`;
			const newMessageLink = `https://discord.com/channels/${process.env.GUILD_ID}/${msg.channel.id}/${msg.id}`;
			await moderatorChannel.send({
				content: `**Advertencia:** Posible post duplicado: #1 {${oldMessageLink}} #2 {${newMessageLink}}`,
			});
		}
	}
}
