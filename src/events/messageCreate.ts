import {
	ChannelType,
	DMChannel,
	EmbedBuilder,
	Events,
	Guild,
	GuildBasedChannel,
	Message,
	PublicThreadChannel,
	Sticker,
	TextChannel,
} from "discord.js";
import { ExtendedClient } from "../client.js";
import {
	AUTHORIZED_BOTS,
	COLORS,
	commandProcessingLimiter,
	DISBOARD_UID,
	EMOJIS,
	getChannelFromEnv,
	getHelpForumsIdsFromEnv,
	getRoleFromEnv,
	messagesProcessingLimiter,
} from "../utils/constants.js";
import { Users } from "../Models/User.js";
import { getCooldown, setCooldown } from "../utils/cooldowns.js";
import { checkRole, convertMsToUnixTimestamp } from "../utils/generic.js";
import { checkHelp } from "../utils/checkhelp.js";
import { bumpHandler } from "../utils/bumpHandler.js";
import natural from "natural";
import { checkMentionSpam, IDeletableContent, spamFilter } from "../security/spamFilters.js";
import { hashMessage } from "../security/messageHashing.js";

const PREFIX = "!"; // Define tu prefijo

export default {
	name: Events.MessageCreate,
	async execute(message: Message) {
		if (AUTHORIZED_BOTS.includes(message.author.id)) return;
		if (
			message.author.id === DISBOARD_UID &&
			message.embeds.length &&
			message.embeds[0].data.color == COLORS.lightSeaGreen &&
			message.embeds[0].data.description?.includes(EMOJIS.thumbsUp)
		) {
			return bumpHandler(message.client as ExtendedClient, message);
		}

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

		if (
			!(
				message.channel.parentId === getChannelFromEnv("categoryStaff") ||
				message.member?.permissions.has("Administrator") ||
				client.staffMembers.includes(message.author.id)
			)
		) {
			if (
				(await spamFilter(message.member, client, message as IDeletableContent, message.content)) ||
				(await checkMentionSpam(message, client))
			)
				return;
		}
		if (message.author.bot || message.author.system) return;

		if (!message.content.startsWith(PREFIX)) {
			messagesProcessingLimiter.schedule(async () => processCommonMessage(message, client));
		} else {
			commandProcessingLimiter.schedule(async () => processPrefixCommand(message, client));
		}
	},
};

function processCommonMessage(message: Message, client: ExtendedClient) {
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
		message.stickers.forEach((sticker: Sticker) => {
			ExtendedClient.trending.add("sticker", sticker.id);
		});
		const emojiIds = [...message.content.matchAll(/<a?:\w+:(\d+)>/g)].map((match) => match[1]) || [];
		emojiIds.forEach((emojiId: string) => {
			ExtendedClient.trending.add("emoji", emojiId);
		});
	}
}

async function processPrefixCommand(message: Message, client: ExtendedClient) {
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
				let warn = await (msg.channel as TextChannel).send({
					content: `🚫 <@${
						msg.author.id
					}>Por favor, espera 1 semana entre publicaciónes similares en los canales de compartir. (Tiempo restante: <t:${convertMsToUnixTimestamp(
						cooldown
					)}:R>)`,
				});
				await msg.delete().catch(() => null);
				setTimeout(async () => await warn.delete().catch(() => null), 10000);
			} else {
				client.agregarCompartePost(msg.author.id, msg.channel.id, msg.id, hashMessage(msg.content));
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
				let warn = await (msg.channel as TextChannel).send({
					content: `🚫 <@${
						msg.author.id
					}>Por favor, espera 1 semana entre publicaciónes similares en los canales de compartir. (Tiempo restante: <t:${convertMsToUnixTimestamp(
						cooldown
					)}:R>)`,
				});
				await msg.delete();

				await setTimeout(() => warn.delete(), 10000);
			} else {
				client.agregarCompartePost(msg.author.id, msg.channel.id, msg.id, hashMessage(msg.content));
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
	let channel: GuildBasedChannel | TextChannel | null;
	if (msg.channel.type === ChannelType.PublicThread) {
		const channels = (msg.guild as Guild).channels;
		channel =
			channels.cache.get((msg.channel as PublicThreadChannel).parentId ?? "") ??
			channels.resolve((msg.channel as PublicThreadChannel).parentId ?? "");
		const threadAuthor = await (msg.channel as PublicThreadChannel).fetchOwner().catch(() => null);
		if (threadAuthor?.id !== msg.author.id) return false;
	} else channel = msg.channel as TextChannel;
	return getHelpForumsIdsFromEnv().includes(channel?.id ?? "");
}

async function checkCooldownComparte(msg: Message<boolean>, client: ExtendedClient) {
	let lastPosts = ExtendedClient.ultimosCompartePosts
		.get(msg.author.id)
		?.filter((post) => post.date.getTime() + 1000 * 60 * 60 * 24 * 7 >= Date.now());

	if (!lastPosts) return;
	let cooldownPost: number | undefined = undefined;
	for (const post of lastPosts) {
		const channel = (client.channels.cache.get(post.channelId) ?? client.channels.resolve(post.channelId)) as TextChannel;
		await channel.messages
			.fetch(post.messageId)
			.then(async (message) => {
				let distance = natural.JaroWinklerDistance(message.content, msg.content, { ignoreCase: true });
				if (distance > 0.9) {
					if (cooldownPost === undefined) cooldownPost = post.date.getTime() + 1000 * 60 * 60 * 24 * 7 - Date.now();
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
			})
			.catch(() => {
				if (cooldownPost === undefined && hashMessage(msg.content) === post.hash)
					cooldownPost = post.date.getTime() + 1000 * 60 * 60 * 24 * 7 - Date.now();
			});
	}
	return cooldownPost;
}
