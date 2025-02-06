import { Message, EmbedBuilder } from "discord.js";
import natural from "natural";
import {
	ANTI_DUMBS_RESPONSES,
	emojiMapper,
	geminiModel,
	getCachedImage,
	getColorFromEmojiFile,
	modelPyeChanAnswer,
	pyeChanPrompt,
	pyeChanSecurityConstraint,
} from "./gemini.js";
import { ExtendedClient } from "../../client.js";
import { findEmojis, splitMessage } from "../generic.js";

/**
 * Genera la respuesta para un foro.
 * @param context El contexto obtenido de la cadena de mensajes.
 * @param threadName El nombre del hilo (tema principal).
 * @param forumTopic Información adicional del tema.
 * @returns El texto generado por IA.
 */
export async function generateForumResponse(context: string, threadName: string, forumTopic: string): Promise<string> {
	const prompt = `El tema principal es: "${threadName}" (${forumTopic}) si no lo entiendes no le des importancia. El contexto es: \n"${context}"`;
	const result = await geminiModel.generateContent(prompt);
	return result.response.text();
}

/**
 * Genera la respuesta para un mensaje “normal” (no foro).
 * @param context El contexto o mensaje a enviar a la IA.
 * @param authorId El id del autor, para logging.
 * @returns El texto generado por IA.
 */
export async function generateChatResponse(context: string, authorId: string, model = modelPyeChanAnswer): Promise<string> {
	const result = await model.generateContent(context + pyeChanSecurityConstraint).catch((e) => {
		ExtendedClient.logError("Error al generar la respuesta de PyEChan:" + e.message, e.stack, authorId);
		return {
			response: { text: () => "Mejor comamos un poco de sushi! 🍣" },
		};
	});
	let text = result.response.text();
	// Si el texto es muy similar al prompt (respuesta por defecto), elegimos una respuesta alternativa
	if (natural.JaroWinklerDistance(text, pyeChanPrompt) > 0.8) {
		text = ANTI_DUMBS_RESPONSES[Math.floor(Math.random() * ANTI_DUMBS_RESPONSES.length)];
	}
	return text;
}

/**
 * Crea el embed para la respuesta en foro.
 * @param responseText El texto generado por IA.
 * @returns Un EmbedBuilder configurado.
 */
export function createForumEmbed(responseText: string): EmbedBuilder {
	return new EmbedBuilder().setColor(0x0099ff).setDescription(responseText).setFooter({ text: "✨ Generado por IA" });
}

/**
 * Crea el embed para la respuesta en chat.
 * @param text El texto generado por IA.
 * @returns Un EmbedBuilder configurado.
 */
export function createChatEmbed(text: string): EmbedBuilder {
	const emojiFile = emojiMapper(findEmojis(text)[0] ?? "");
	return new EmbedBuilder()
		.setColor(getColorFromEmojiFile(emojiFile))
		.setAuthor({
			name: "PyE Chan",
			iconURL:
				"https://cdn.discordapp.com/attachments/1115058778736431104/1282790824744321167/vecteezy_heart_1187438.png?ex=66e0a38d&is=66df520d",
			url: "https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png",
		})
		.setDescription(text)
		.setThumbnail("https://cdn.discordapp.com/attachments/1282932921203818509/1332238415676047430/pyechan.png")
		.setImage(getCachedImage(emojiFile))
		.setTimestamp()
		.setFooter({ text: "♥" });
}

const MAX_MESSAGE_LENGTH = 2000;

/**
 * Envía la respuesta en múltiples mensajes si supera el largo máximo.
 * @param message El mensaje original.
 * @param embed El embed base.
 * @param fullMessage El mensaje completo a enviar.
 */
export async function sendLongReply(message: Message<boolean>, embed: EmbedBuilder, fullMessage: string) {
	if (fullMessage.length <= MAX_MESSAGE_LENGTH) {
		await message.reply({ embeds: [embed] });
	} else {
		const chunks = splitMessage(fullMessage, MAX_MESSAGE_LENGTH);
		let lastMsg: Message | null | undefined;
		for (const chunk of chunks) {
			if (lastMsg) {
				lastMsg = await lastMsg.reply({ embeds: [embed.setDescription(chunk)] }).catch(() => null);
			} else if (message.channel.isSendable()) {
				lastMsg = await message.reply({ embeds: [embed.setDescription(chunk)] }).catch(() => null);
			}
		}
	}
}
