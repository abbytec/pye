import { Message, EmbedBuilder, ThreadChannel, DiscordAPIError } from "discord.js";
import natural from "natural";
import {
	ANTI_DUMBS_RESPONSES,
	emojiMapper,
	geminiModel,
	getCachedImage,
	getColorFromEmojiFile,
	modelPyeChanAnswer,
	modelPyeChanReasoningAnswer,
	pyeChanPrompt,
	aiSecurityConstraint,
} from "./gemini.js";
import { ExtendedClient } from "../../client.js";
import { findEmojis, splitMessage } from "../generic.js";
import { GenerateContentRequest, GoogleGenerativeAIError, GoogleGenerativeAIFetchError, Part } from "@google/generative-ai";

export async function generateForumResponse(
	context: string,
	threadName: string,
	forumTopic: string,
	image?: { mimeType: string; base64: string }
): Promise<string> {
	let userParts: Part[] = [];

	// Se construye un contexto enriquecido para el foro
	const forumContext = `Foro: ${forumTopic}\nHilo: ${threadName}\nContexto: ${context}`;

	userParts.push({
		text: forumContext,
	});

	if (image) {
		userParts.push({
			inlineData: {
				mimeType: image.mimeType,
				data: image.base64,
			},
		});
	}

	const request: GenerateContentRequest = {
		contents: [
			{
				role: "user",
				parts: userParts,
			},
		],
	};

	const result = await geminiModel.generateContent(request).catch((e) => {
		if (e instanceof GoogleGenerativeAIFetchError && e.status !== 503)
			ExtendedClient.logError("Error al generar la respuesta de PyEChan en foro: " + e.message, e.stack, process.env.CLIENT_ID);

		return {
			response: { text: () => "En este momento, la IA no puede responder tu pregunta." },
		};
	});

	let text = result.response.text();

	// Si el texto obtenido es muy similar al prompt (respuesta por defecto), se selecciona una respuesta alternativa
	if (natural.JaroWinklerDistance(text, pyeChanPrompt) > 0.8) {
		text = ANTI_DUMBS_RESPONSES[Math.floor(Math.random() * ANTI_DUMBS_RESPONSES.length)];
	}

	return text;
}

export async function generateChatResponse(context: string, authorId: string, image?: { mimeType: string; base64: string }): Promise<string> {
	let userParts: Part[] = [];

	userParts = [
		{
			text: context,
		},
	];

	if (image) {
		userParts.push({
			inlineData: {
				mimeType: image.mimeType,
				data: image.base64,
			},
		});
	}

	let request: GenerateContentRequest = {
		contents: [
			{
				role: "user",
				parts: userParts,
			},
		],
	};

	const result = await modelPyeChanAnswer.generateContent(request).catch((e) => {
		if (e instanceof GoogleGenerativeAIFetchError && e.status === 503)
			return {
				response: {
					text: () => "En este momento, comí demasiado sushi como para procesar esta respuesta! 🍣\nIntente denuevo mas tarde.",
				},
			};
		ExtendedClient.logError("Error al generar la respuesta de PyEChan:" + e.message, e.stack, authorId);
		return {
			response: { text: () => "Mejor comamos un poco de sushi! 🍣" },
		};
	});
	let text;
	try {
		text = result.response.text();
	} catch (error) {
		text = "Mejor comamos un poco de sushi! 🍣";
	}
	// Si el texto es muy similar al prompt (respuesta por defecto), elegimos una respuesta alternativa
	if (natural.JaroWinklerDistance(text, pyeChanPrompt) > 0.8) {
		text = ANTI_DUMBS_RESPONSES[Math.floor(Math.random() * ANTI_DUMBS_RESPONSES.length)];
	}
	return text;
}

export async function generateChatResponseStream(context: string, authorId: string): Promise<string> {
	const result = await modelPyeChanReasoningAnswer.generateContentStream(context + aiSecurityConstraint).catch((e) => {
		ExtendedClient.logError("Error al generar la respuesta de PyEChan:" + e.message, e.stack, authorId);
		return {
			response: new Promise<{ text: () => string }>(() => {
				return { text: () => "Mejor comamos un poco de sushi! 🍣" };
			}),
		};
	});
	let text = (await result.response).text();
	// Si el texto es muy similar al prompt (respuesta por defecto), elegimos una respuesta alternativa
	if (natural.JaroWinklerDistance(text, pyeChanPrompt) > 0.8) {
		text = ANTI_DUMBS_RESPONSES[Math.floor(Math.random() * ANTI_DUMBS_RESPONSES.length)];
	}
	return text;
}
export class ForumAIError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ForumError";
	}
}

export function createForumEmbed(responseText: string, helloUsername?: string): EmbedBuilder {
	// Chequear si alguna vez ocurre esto... Porque hubo logs de errores extraños donde fallaba el setDescription
	if (typeof responseText !== "string") ExtendedClient.logError("Respuesta extraña de la IA en foro", responseText, process.env.CLIENT_ID);
	if (!responseText || responseText.length === 0) throw new ForumAIError("La IA dió una respuesta vacía");
	const embedBuilder = new EmbedBuilder().setColor(0x0099ff).setFooter({ text: "✨ Generado por IA" });

	let fullMessage: string = responseText;
	if (helloUsername) {
		embedBuilder.setTitle(`Hola ${helloUsername}!`);
		fullMessage += `\n\n **Fue útil mi respuesta? 🦾👀 | Recuerda que de todos modos puedes esperar que otros usuarios te ayuden!** 😉`;
	}
	embedBuilder.setDescription(fullMessage);
	return embedBuilder;
}

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
export async function sendLongReply(message: Message<boolean> | ThreadChannel, embed: EmbedBuilder, fullMessage: string) {
	if ("send" in message) {
		if (fullMessage.length <= MAX_MESSAGE_LENGTH) {
			await message.send({ embeds: [embed] });
		} else {
			const chunks = splitMessage(fullMessage, MAX_MESSAGE_LENGTH);
			let lastChunk: Message | undefined;
			for (const chunk of chunks) {
				const chunkEmbed = new EmbedBuilder().setColor(0x0099ff).setDescription(chunk).setFooter({ text: "✨ Generado por IA" });

				if (lastChunk) {
					await lastChunk.reply({ embeds: [chunkEmbed] });
				} else {
					await message.send({ embeds: [chunkEmbed] }).then((msg) => (lastChunk = msg));
				}
			}
		}
	} else if ("reply" in message) {
		if (fullMessage.length <= MAX_MESSAGE_LENGTH) {
			await message.reply({ embeds: [embed] });
		} else {
			const chunks = splitMessage(fullMessage, MAX_MESSAGE_LENGTH);
			let lastMsg: Message | null | undefined;
			for (const chunk of chunks) {
				lastMsg = await (lastMsg ?? message).reply({ embeds: [embed.setDescription(chunk)] }).catch(() => null);
			}
		}
	}
}
