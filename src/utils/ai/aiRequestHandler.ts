import {
	Message,
	PublicThreadChannel,
	EmbedBuilder,
	DiscordAPIError,
	MessagePayload,
	MessageReplyOptions,
	AttachmentBuilder,
	OmitPartialGroupDMChannel,
	ChannelType,
	TextChannel,
} from "discord.js";
import { ExtendedClient } from "../../client.js";
import { getForumTopic, getRoleFromEnv, COLORS } from "../constants.js";
import { getTextAttachmentsContent, getFirstValidAttachment } from "../generic.js";
import { incrRedisCounter } from "../redisCounters.js";
import {
	generateForumResponse,
	createForumEmbed,
	sendLongReply,
	ForumAIError,
	generateChatResponse,
	createChatEmbed,
} from "./aiResponseService.js";
import { getRecursiveRepliedContext } from "./getRecursiveRepliedContext.js";
import fs from "fs";
import { AIUsageControlService } from "../../core/AIUsageControlService.js";

export async function manageAIResponse(message: Message<boolean>, isForumPost: string | undefined, isDm: boolean = false) {
	if (message.mentions.everyone) return;
	const textWithoutMentions = message.content.replace(/<@!?\d+>/g, "").trim();

	const isOnlyMentionsText = textWithoutMentions.length === 0;
	let botIsMentioned = message.mentions.has(process.env.CLIENT_ID ?? "");
	let botShouldAnswer = botIsMentioned || isDm || message.mentions.repliedUser?.id === process.env.CLIENT_ID;

	if (((!botIsMentioned && message.mentions.users.size > 0) || (botIsMentioned && message.mentions.users.size > 1)) && isOnlyMentionsText)
		return;

	if (botShouldAnswer) {
		if (await checkReachedAIRateLimits(message)) return;

		let contexto = await getRecursiveRepliedContext(message, !isForumPost);

		const textFilesContent = await getTextAttachmentsContent(message.attachments);

		if (textFilesContent) {
			contexto = contexto + textFilesContent;
		}

		const attachmentData = await getFirstValidAttachment(message.attachments).catch(async (e) => {
			message.reply(e.message);
			return undefined;
		});

		if (isForumPost) {
			const threadName = (message.channel as PublicThreadChannel).name;
			const forumTopic = getForumTopic(isForumPost ?? "");
			try {
				const fullMessage = await generateForumResponse(contexto, threadName, forumTopic, attachmentData);
				const embed = createForumEmbed(fullMessage);
				await sendLongReply(message, embed, fullMessage);
			} catch (err: any) {
				let errorEmbed;
				let desc = "Error al generar la respuesta. ";
				errorEmbed = new EmbedBuilder().setColor(0xff0000).setTitle("Error").setFooter({ text: "Por favor, intenta más tarde." });
				if (err instanceof DiscordAPIError && err.message == "Unknown message") {
					errorEmbed.setDescription(desc + "No se encontró el mensaje original.");
					if (message.channel.isSendable()) await message.channel.send({ embeds: [errorEmbed] }).catch(() => null);
				} else if (err instanceof ForumAIError) {
					errorEmbed.setDescription(desc + err.message);
					if (message.channel.isSendable()) await message.channel.send({ embeds: [errorEmbed] }).catch(() => null);
				} else {
					ExtendedClient.logError("Error al generar la respuesta de IA en foro:" + err.message, err.stack, message.author.id);
					await message.reply({ embeds: [errorEmbed] }).catch(() => null);
				}
			}
		} else {
			const expertAILevelmode = checkExpertAIMode(message);
			const response = await generateChatResponse(contexto, message.author.id, attachmentData, expertAILevelmode);
			const embed = createChatEmbed(response.text, expertAILevelmode);
			let fileName: string | undefined;
			let responseToReply: MessagePayload | MessageReplyOptions = {};
			if (response.image) {
				fileName = `generated_image${Date.now()}.png`;
				fs.writeFileSync(fileName, new Uint8Array(response.image));

				const attachment = new AttachmentBuilder(fileName, { name: fileName });

				embed.setImage(`attachment://${fileName}`);

				responseToReply = {
					files: [attachment],
				};
			}

			responseToReply.embeds = [embed];

			await message
				.reply(responseToReply)
				.then((msg: OmitPartialGroupDMChannel<Message<boolean>>) => {
					if (!response.image) {
						const textLength = Math.max(msg.embeds[0]?.data?.description?.length ?? 0, 256);
						const delayMs = Math.ceil((textLength / 256) * 13000);
						setTimeout(() => {
							const embedWithoutImage = msg.embeds.map((embed) => {
								return {
									...embed.data,
									image: undefined,
								};
							});

							msg.edit({ embeds: embedWithoutImage });
						}, delayMs);
					}
				})
				.catch(() => null)
				.finally(() => {
					if (fileName && response.image) fs.unlinkSync(fileName);
				});
		}
	}
}

export function checkExpertAIMode(message: Message<boolean>) {
	if (message.channel.isThread()) {
		const thread = message.channel;
		if (thread.parent?.nsfw) {
			if (
				message.member?.roles.cache.has(getRoleFromEnv("experto")) ||
				message.member?.roles.cache.has(getRoleFromEnv("adalovelace")) ||
				message.member?.roles.cache.has(getRoleFromEnv("nitroBooster")) ||
				message.member?.roles.cache.has(getRoleFromEnv("staff")) ||
				message.member?.roles.cache.has(getRoleFromEnv("moderadorChats")) ||
				message.member?.roles.cache.has(getRoleFromEnv("moderadorVoz"))
			)
				return thread.type == ChannelType.PrivateThread ? 2 : 1;
			if (message.member?.roles.cache.has(getRoleFromEnv("colaborador"))) return 1;
		}
	} else if (
		(message.channel as TextChannel).nsfw &&
		(message.member?.roles.cache.has(getRoleFromEnv("experto")) ||
			message.member?.roles.cache.has(getRoleFromEnv("adalovelace")) ||
			message.member?.roles.cache.has(getRoleFromEnv("nitroBooster")) ||
			message.member?.roles.cache.has(getRoleFromEnv("colaborador")) ||
			message.member?.roles.cache.has(getRoleFromEnv("staff")) ||
			message.member?.roles.cache.has(getRoleFromEnv("moderadorChats")) ||
			message.member?.roles.cache.has(getRoleFromEnv("moderadorVoz")))
	) {
		return 1;
	}
	return 0;
}

export async function checkReachedAIRateLimits(message: Message<boolean>) {
	const member = message.member;
	const isPrivileged =
		member?.roles.cache.has(getRoleFromEnv("colaborador")) ||
		member?.roles.cache.has(getRoleFromEnv("nitroBooster")) ||
		member?.roles.cache.has(getRoleFromEnv("staff")) ||
		member?.roles.cache.has(getRoleFromEnv("moderadorChats")) ||
		member?.roles.cache.has(getRoleFromEnv("moderadorVoz"));
	const used = AIUsageControlService.dailyAIUsage.get(message.author.id) ?? 0;
	if (!isPrivileged) {
		if (used >= 30) {
			const embed = new EmbedBuilder()
				.setColor(COLORS.warnOrange)
				.setTitle("Límite diario alcanzado")
				.setDescription(
					`Has llegado a tu límite de usos de **30 mensajes diarios**.\n\n` +
						`Para seguir usando PyE-chan hoy, obtén el rol <@&${getRoleFromEnv("colaborador")}> ` +
						`añadiendo la vanity **.gg/programacion** a tu estado ` +
						`o boosteando el servidor.`
				);

			await message.reply({ embeds: [embed] }).catch(() => null);
			return true;
		}
	} else if (used >= 350) {
		const embed = new EmbedBuilder()
			.setColor(COLORS.warnOrange)
			.setTitle("Límite diario alcanzado")
			.setDescription(
				`Has llegado a tu límite diario de **350 mensajes diarios**.\n\n` +
					`Por favor, permite que otros usuarios también pueden usar la IA.`
			);
		await message.reply({ embeds: [embed] }).catch(() => null);
		return true;
	}
	AIUsageControlService.dailyAIUsage.set(message.author.id, used + 1);
	incrRedisCounter("dailyAIUsage", message.author.id, 1).catch(() => null);
	return false;
}
