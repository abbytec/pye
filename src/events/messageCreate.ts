import {
	ChannelType,
	DMChannel,
	EmbedBuilder,
	Events,
	Guild,
	GuildMember,
	Message,
	PublicThreadChannel,
	Sticker,
	StickerType,
	TextChannel,
	User,
} from "discord.js";
import { ExtendedClient } from "../client.js";
import {
	AUTHORIZED_BOTS,
	COLORS,
	commandProcessingLimiter,
	DISBOARD_UID,
	EMOJIS,
	getChannelFromEnv,
	getForumTopic,
	getHelpForumsIdsFromEnv,
	getRoleFromEnv,
	messagesProcessingLimiter,
	PREFIX,
} from "../utils/constants.js";
import { Users } from "../Models/User.js";
import { getCooldown, setCooldown } from "../utils/cooldowns.js";
import { checkRole, convertMsToUnixTimestamp } from "../utils/generic.js";
import { checkHelp } from "../utils/checkhelp.js";
import { bumpHandler } from "../utils/bumpHandler.js";
import natural from "natural";
import { checkMentionSpam, IDeletableContent, spamFilter } from "../security/spamFilters.js";
import { hashMessage } from "../security/messageHashing.js";
import { getRecursiveRepliedContext } from "../utils/ai/getRecursiveRepliedContext.js";
import { checkQuestLevel, IQuest } from "../utils/quest.js";
import path from "path";
import { fileURLToPath } from "url";
import { createChatEmbed, createForumEmbed, generateChatResponse, generateForumResponse, sendLongReply } from "../utils/ai/aiResponseService.js";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
			return bumpHandler(message);
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
				client.staffMembers.includes(message.author.id) ||
				message.member?.roles.cache.has(getRoleFromEnv("instructorDeTaller"))
			)
		) {
			let member: GuildMember | User | null = message.interactionMetadata?.user ?? null;
			if (member) {
				member = await message.guild?.members.fetch(member.id).catch(() => message.member);
			} else {
				member = message.member;
			}
			if ((await spamFilter(member, client, message as IDeletableContent, message.content)) || (await checkMentionSpam(message, client)))
				return;
		}
		if (message.author.bot || message.author.system) return;

		if (!message.content.startsWith(PREFIX)) {
			messagesProcessingLimiter.schedule(async () => await processCommonMessage(message, client));
		} else {
			commandProcessingLimiter.schedule(async () => await processPrefixCommand(message, client));
		}
	},
};

async function processCommonMessage(message: Message, client: ExtendedClient) {
	let checkingChanel;
	if (![getChannelFromEnv("mudae"), getChannelFromEnv("casinoPye")].includes(message.channel.id)) {
		const moneyConfig = client.getMoneyConfig(process.env.CLIENT_ID ?? "");
		getCooldown(client, message.author.id, "farm-text", moneyConfig.text.time).then(async (time) => {
			if (time > 0) {
				Users.findOneAndUpdate({ id: message.author.id }, { $inc: { cash: moneyConfig.text.coins } }, { upsert: true })
					.exec()
					.then(() => {
						setCooldown(client, message.author.id, "farm-text", moneyConfig.text.time);
					});
			}
		});

		checkQuestLevel({ msg: message, text: 1, userId: message.author.id } as IQuest);

		await specificChannels(message, client);
		checkingChanel = checkThanksChannel(message);
		if (checkingChanel && (await checkUserThanking(message))) {
			checkHelp(message);
		}
		registerNewTrends(message, client);
		manageAIResponse(message, checkingChanel);
	}
}

async function processPrefixCommand(message: Message, client: ExtendedClient) {
	const commandBody = message.content.slice(PREFIX.length).trim();
	const commandName = commandBody.split(/ +/, 1).shift()?.toLowerCase() ?? "";

	// Verifica si el comando existe en la colección de comandos
	const command = client.prefixCommands.get(commandName);

	if (!command) {
		message.reply("Ese comando no existe, quizá se actualizó a Slash Command :point_right: /.\n Prueba escribiendo /help.");
		return;
	}

	try {
		const parsedMessage = await command.parseMessage(message);
		if (parsedMessage) {
			client.commands.get(command.commandName)?.execute(parsedMessage);
		} else {
			message.reply({ content: "Hubo un error ejecutando ese comando.", ephemeral: true } as any);
		}
	} catch (error: any) {
		console.error(`Error ejecutando el comando ${commandName}:`, error);
		message.reply({ content: "Hubo un error ejecutando ese comando.\n" + error.message, ephemeral: true } as any);
	}
}

const employmentsDescription =
	"• No pagues ni entregues ningún trabajo y/o servicio en su totalidad hasta estar completamente seguro que la otra persona es confiable.\n" +
	"• No pagues ni entregues ningúno trabajo y/o servicio en su totalidad hasta estar completamente seguro que la otra persona es confiable.\n" +
	"• Sugerímos realizar pagos pequeños por hitos, es decir, entregables pequeños que muestren un avance real. Asi como pactar previamente comisiones externas como por ejemplo, si el monto a transferir incluye impuestos o estos se contabilizan aparte.\n" +
	"• Si la publicación no ofrece muchos datos al respecto, debes dudar de la misma o bien puedes reportarla a un moderador.\n" +
	"• Si tienes pruebas sobre la conducta cuestionable de un usuario, puedes reportarlo para impedirle el acceso a estos canales.\n" +
	"\nDesde este servidor nos comprometemos a mantener estos canales lo más seguros y ordenados dentro de lo posible, **sin embargo** nuestro rol principal es el de brindar un lugar para que los usuarios puedan visibilizar sus publicaciones. Muchas resoluciones de conflicto *exceden* nuestro alcance y obligaciones, por eso recomendamos encarecidamente tener precaución.\n¡En nombre del Staff agradecemos tu atención!";

async function specificChannels(msg: Message<boolean>, client: ExtendedClient) {
	switch (msg.channel.id) {
		case getChannelFromEnv("recursos"):
			msg.react("👍").catch(() => null);
			msg.react("👎").catch(() => null);
			msg.react("⭐").catch(() => null);
			msg.startThread({ name: `${msg.author.username}'s Thread` });
			checkRole(msg, getRoleFromEnv("granAportador"), 50);
			break;
		case getChannelFromEnv("ofreceServicios"):
		case getChannelFromEnv("ofertasDeEmpleos"): {
			checkCooldownComparte(msg, client).then(async (cooldown) => {
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
									.setTitle("Protege tu dinero y asegurate de que tu trabajo sea finalizado")
									.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" }))
									.setDescription(
										"Por favor te __recordamos__ tomar todas las precauciones posibles al interactuar en estos canales ya que el staff no puede **intervenir** con estafas. **SOLAMENTE TÚ PUEDES EVITAR SER VÍCTIMA DE UNA ESTAFA.**"
									),
								new EmbedBuilder()
									.setTitle("Recomendaciones")
									.setDescription(employmentsDescription)
									.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" })),
							],
						});
					});
					await setCooldown(client, msg.author.id, "comparte-post", 1000 * 60 * 60 * 24 * 7);
				}
			});
			break;
		}
		case getChannelFromEnv("proyectosNoPagos"): {
			checkCooldownComparte(msg, client).then(async (cooldown) => {
				if (cooldown) {
					let warn = await (msg.channel as TextChannel).send({
						content: `🚫 <@${
							msg.author.id
						}>Por favor, espera 1 semana entre publicaciónes similares en los canales de compartir. (Tiempo restante: <t:${convertMsToUnixTimestamp(
							cooldown
						)}:R>)`,
					});
					await msg.delete().catch(() => null);

					await setTimeout(async () => await warn.delete().catch(() => null), 10000);
				} else {
					client.agregarCompartePost(msg.author.id, msg.channel.id, msg.id, hashMessage(msg.content));
					msg.startThread({ name: `${msg.author.username}'s Thread` }).then((thread) => {
						thread.send({
							content: `Hey ${msg.author.toString()}!`,
							embeds: [
								new EmbedBuilder()
									.setTitle("¡Evita que te estafen!")
									.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" }))
									.setDescription(
										"Por favor te __recordamos__ tomar todas las precauciones posibles al interactuar en estos canales ya que el staff no puede **intervenir** con estafas. **SOLAMENTE TÚ PUEDES EVITAR SER VÍCTIMA DE UNA ESTAFA.**"
									),
							],
						});
					});
					await setCooldown(client, msg.author.id, "comparte-post", 1000 * 60 * 60 * 24 * 7);
				}
			});
			break;
		}
		case getChannelFromEnv("memes"):
			msg.react("💤").catch(() => null);
			msg.react("♻️").catch(() => null);
			msg.react("<:xdlol:922955890200576001>").catch(() => null);
			msg.react("<:KEKW:796227219591921704>").catch(() => null);
			checkRole(msg, getRoleFromEnv("especialistaEnMemes"), 75);
			break;
		case getChannelFromEnv("filosofiaPolitica"):
			checkRole(msg, getRoleFromEnv("granDebatidor"), 500);
			break;
	}
}

/** Check user to trigger Point Helper system */
async function checkUserThanking(msg: Message<boolean>) {
	if (msg.channel.type === ChannelType.PublicThread) {
		const threadAuthor = await (msg.channel as PublicThreadChannel).fetchOwner().catch(() => null);
		return threadAuthor?.id === msg.author.id;
	}
}

/** Check channels to trigger Point Helper system */
function checkThanksChannel(msg: Message<boolean>) {
	let channelId: string | undefined = undefined;
	if (msg.channel.type === ChannelType.PublicThread) {
		channelId = (msg.channel as PublicThreadChannel).parentId ?? undefined;
	}
	return getHelpForumsIdsFromEnv().includes(channelId ?? "") ? channelId : undefined;
}

async function registerNewTrends(message: Message<boolean>, client: ExtendedClient) {
	message.stickers.forEach((sticker: Sticker) => {
		if (client.getStickerTypeCache(sticker) === StickerType.Guild) ExtendedClient.trending.add("sticker", sticker.id);
	});
	const emojiIds =
		[...message.content.matchAll(/<(a?:\w+:\d+)>/g)].map((match) => (match[1].startsWith(":") ? match[1].slice(1) : match[1])) || [];
	emojiIds.forEach((emojiId: string) => {
		ExtendedClient.trending.add("emoji", emojiId);
	});
}

async function checkCooldownComparte(msg: Message<boolean>, client: ExtendedClient): Promise<number | undefined> {
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

				const oldMessageLink = `https://discord.com/channels/${process.env.GUILD_ID}/${post.channelId}/${post.messageId}`;
				if (distance > 0.9) {
					const logMessagesChannel = (client.channels.cache.get(getChannelFromEnv("logMessages")) ??
						client.channels.resolve(getChannelFromEnv("logMessages"))) as TextChannel;
					if (!logMessagesChannel)
						ExtendedClient.logError(
							"checkCooldownComparte: No se encontró el canal de log de Mensajes.",
							undefined,
							process.env.CLIENT_ID
						);
					if (cooldownPost === undefined) cooldownPost = post.date.getTime() + 1000 * 60 * 60 * 24 * 7 - Date.now();
					await logMessagesChannel.send({
						content: `**Advertencia:** Se eliminó un post duplicado: ${oldMessageLink} en canal <#${post.channelId}>`,
					});
				} else if (distance > 0.75) {
					const moderatorChannel = (client.channels.cache.get(getChannelFromEnv("notificaciones")) ??
						client.channels.resolve(getChannelFromEnv("notificaciones"))) as TextChannel;
					if (!moderatorChannel)
						ExtendedClient.logError(
							"checkCooldownComparte: No se encontró el canal de notificaciones.",
							undefined,
							process.env.CLIENT_ID
						);
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

const MAX_MESSAGE_LENGTH = 2000;

export async function manageAIResponse(message: Message<boolean>, isForumPost: string | undefined) {
	if (message.mentions.everyone) return;

	let botShouldAnswer = message.mentions.has(process.env.CLIENT_ID ?? "");

	// Si el mensaje es una respuesta, se verifica si el mensaje original fue enviado por el bot
	if (message.reference?.messageId) {
		botShouldAnswer =
			botShouldAnswer ||
			(await message.channel.messages
				.fetch(message.reference.messageId)
				.then((msg: Message) => msg.author.id)
				.catch(() => null)) === process.env.CLIENT_ID;
	}

	if (botShouldAnswer) {
		const contexto = await getRecursiveRepliedContext(message, !isForumPost);

		if (isForumPost) {
			const threadName = (message.channel as PublicThreadChannel).name;
			const forumTopic = getForumTopic(isForumPost ?? "");
			try {
				const fullMessage = await generateForumResponse(contexto, threadName, forumTopic);
				const embed = createForumEmbed(fullMessage);
				await sendLongReply(message, embed, fullMessage);
			} catch (err: any) {
				ExtendedClient.logError("Error al generar la respuesta de IA en foro:" + err.message, err.stack, message.author.id);
				const errorEmbed = new EmbedBuilder()
					.setColor(0xff0000)
					.setTitle("Error")
					.setDescription("Error al generar la respuesta.")
					.setFooter({ text: "Por favor, intenta más tarde." });
				await message.reply({ embeds: [errorEmbed] });
			}
		} else {
			const imageAttachments = message.attachments.filter((attachment) => attachment.contentType?.startsWith("image/"));
			let imageBase64: { mimeType: string; imageBase64: string } | undefined = undefined;
			if (imageAttachments.size > 0) {
				imageBase64 = await fetch(imageAttachments.at(0)?.url ?? "")
					.then((r) => r.arrayBuffer())
					.then((arrayBuffer) => Buffer.from(arrayBuffer))
					.then((buffer) => {
						return { mimeType: imageAttachments.at(0)?.contentType ?? "", imageBase64: buffer.toString("base64") };
					})
					.catch(() => undefined);
			}
			const text = await generateChatResponse(contexto, message.author.id, imageBase64);
			const embed = createChatEmbed(text);
			await message.reply({ embeds: [embed] }).catch(() => null);
		}
	}
}
