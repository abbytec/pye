import { Message, EmbedBuilder, ThreadChannel } from "discord.js";
import natural from "natural";
import {
	ANTI_DUMBS_RESPONSES,
	emojiMapper,
	getCachedImage,
	getColorFromEmojiFile,
	modelPyeChanAnswer,
	modelPyeChanReasoningAnswer,
	pyeChanPrompt,
	pyeChanReasoningPrompt,
	pyeBotPrompt,
	modelPyeBotAnswer,
	modelPyeChanImageAnswer,
	modelPyeChanAudioAnswer,
	modelPyeChanSearchAnswer,
	modelPyeChanAnswerNSFW,
	modelPyeChanAnswerPoliticallyUnrestricted,
} from "./gemini.js";
import { ExtendedClient } from "../../client.js";
import { findEmojis, splitMessage } from "../generic.js";
import {
	EnhancedGenerateContentResponse,
	GenerateContentCandidate,
	GenerateContentRequest,
	GoogleGenerativeAIFetchError,
	Part,
} from "@google/generative-ai";
import { saveUserPreferences, UserMemoryResponse } from "./userMemory.js";
import { Reminder, scheduleDMReminder } from "./dmReminders.js";
import { COLORS } from "../constants.js";

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

	const result = await modelPyeBotAnswer.generateContent(request, { timeout: 10000 }).catch((e) => {
		if (e instanceof GoogleGenerativeAIFetchError && e.status === 503)
			return {
				response: {
					text: () => "En este momento, la IA no puede responder tu pregunta.\nIntente denuevo mas tarde.",
					candidates: [],
				},
			};
		ExtendedClient.logError("Error al generar la respuesta de PyEChan en foro:" + e.message, e.stack, process.env.CLIENT_ID);
		return {
			response: {
				text: () => "En este momento, la IA no puede responder tu pregunta.",
				candidates: [],
			},
		};
	});

	return (await processResponse(result.response, process.env.CLIENT_ID ?? "", pyeBotPrompt)).text;
}

export async function generateChatResponse(
	context: string,
	authorId: string,
	image?: { mimeType: string; base64: string },
	expertAILevel?: number
): Promise<{ text: string; image?: Buffer }> {
	let userParts: Part[] = [{ text: context }];

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

	let model = modelPyeChanAnswer;
	if (expertAILevel == 1) model = modelPyeChanAnswerPoliticallyUnrestricted;
	if (expertAILevel == 2) model = modelPyeChanAnswerNSFW;

	console.log(expertAILevel);

	const result = await model.generateContent(request, { timeout: 10000 }).catch((e) => {
		if (e instanceof GoogleGenerativeAIFetchError && e.status === 503)
			return {
				response: {
					text: () =>
						"En este momento, woowle no tiene stock de sushi como para procesar esta respuesta! 🍣\nIntente denuevo mas tarde.",
					candidates: [],
				},
			};
		console.error(e);
		ExtendedClient.logError("Error al generar la respuesta de PyEChan:" + e.message, e.stack, authorId);
		return {
			response: {
				text: () => "Mejor comamos un poco de sushi! 🍣",
				candidates: [],
			},
		};
	});
	console.log(JSON.stringify(result));
	return processResponse(result.response, authorId, pyeChanPrompt);
}

export async function generateChatResponseSearch(
	context: string,
	authorId: string,
	image?: { mimeType: string; base64: string }
): Promise<{ text: string; image?: Buffer }> {
	let userParts: Part[] = [{ text: context }];

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

	const result = await modelPyeChanSearchAnswer.generateContent(request, { timeout: 10000 }).catch((e) => {
		if (e instanceof GoogleGenerativeAIFetchError && e.status === 503)
			return {
				response: {
					text: () =>
						"En este momento, woowle no tiene stock de sushi como para procesar esta respuesta! 🍣\nIntente denuevo mas tarde.",
					candidates: [],
				},
			};
		console.error(e);
		ExtendedClient.logError("Error al generar la respuesta de PyEChan:" + e.message, e.stack, authorId);
		return {
			response: {
				text: () => "Mejor comamos un poco de sushi! 🍣",
				candidates: [],
			},
		};
	});
	return processResponse(result.response, authorId, pyeChanPrompt);
}

export async function generateChatResponseStream(
	context: string,
	authorId: string,
	image?: { mimeType: string; base64: string }
): Promise<{ text: string; image?: Buffer }> {
	let userParts: Part[] = [{ text: context }];

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

	let result;
	try {
		result = await modelPyeChanReasoningAnswer.generateContentStream(request, { timeout: 10000 });
	} catch (e: any) {
		if (e instanceof GoogleGenerativeAIFetchError && e.status === 503)
			return { text: "En este momento, woowle no tiene stock de sushi como para procesar esta respuesta! 🍣\nIntente denuevo mas tarde." };
		ExtendedClient.logError("Error al generar la respuesta de PyEChan:" + e.message, e.stack, authorId);
		return { text: "Mejor comamos un poco de sushi! 🍣" };
	}

	const response = await result.response;

	return await processResponse(response, authorId, pyeChanReasoningPrompt);
}

export async function generateAudioResponse(
	context: string,
	authorId: string,
	audio?: { mimeType: string; base64: string }
): Promise<{ text: string; audio?: Buffer }> {
	let userParts: Part[] = [{ text: context }];

	if (audio) {
		userParts.push({
			inlineData: {
				mimeType: audio.mimeType,
				data: audio.base64,
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

	const result = await modelPyeChanAudioAnswer.generateContent(request, { timeout: 10000 }).catch((e) => {
		if (e instanceof GoogleGenerativeAIFetchError && e.status === 503)
			return {
				response: {
					text: () =>
						"En este momento, woowle no tiene stock de sushi como para procesar esta respuesta! 🍣\nIntente denuevo mas tarde.",
					candidates: [],
				},
			};
		ExtendedClient.logError("Error al generar la respuesta de PyEChan Audio:" + e.message, e.stack, authorId);
		return {
			response: {
				text: () => "Mejor comamos un poco de sushi! 🍣",
				candidates: [],
			},
		};
	});
	return processResponse(result.response, authorId, pyeChanPrompt);
}

export async function generateImageResponse(
	context: string,
	authorId: string,
	image?: { mimeType: string; base64: string }
): Promise<{ text: string; image?: Buffer }> {
	let userParts: Part[] = [{ text: context }];

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

	const result = await modelPyeChanImageAnswer.generateContent(request, { timeout: 10000 }).catch((e) => {
		if (e instanceof GoogleGenerativeAIFetchError && e.status === 503)
			return {
				response: {
					text: () =>
						"En este momento, woowle no tiene stock de sushi como para procesar esta respuesta! 🍣\nIntente denuevo mas tarde.",
					candidates: [],
				},
			};
		ExtendedClient.logError("Error al generar la respuesta de PyEChan Image:" + e.message, e.stack, authorId);
		return {
			response: {
				text: () => "Mejor comamos un poco de sushi! 🍣",
				candidates: [],
			},
		};
	});
	return processResponse(result.response, authorId, pyeChanPrompt);
}
async function processResponse(
	response: EnhancedGenerateContentResponse | { text: () => string; candidates: GenerateContentCandidate[] },
	authorId: string,
	prompt: string
): Promise<{ text: string; image?: Buffer; audio?: Buffer }> {
	let text = "";
	let image: Buffer | undefined;
	let audio: Buffer | undefined;

	if (response.candidates && response.candidates.length > 0) {
		const candidate = response.candidates[0];
		if (candidate.content?.parts) {
			for (const part of candidate.content.parts) {
				if (part.text) {
					text += part.text;
				} else if (part.functionCall) {
					const { name: functionName, args: functionArgs } = part.functionCall;
					if (functionName === "saveUserPreferences") {
						const args = functionArgs as UserMemoryResponse;
						saveUserPreferences(authorId, args.likes, args.wants);
					} else if (functionName === "createReminder") {
						const args = functionArgs as Reminder;
						await scheduleDMReminder(args.reminderTime, args.message, authorId);
					}
				} else if (part.inlineData) {
					if (part.inlineData.mimeType.startsWith("image")) {
						image = Buffer.from(part.inlineData.data, "base64");
					} else if (part.inlineData.mimeType.startsWith("audio")) {
						audio = Buffer.from(part.inlineData.data, "base64");
					}
				}
			}
		}
	} else {
		text = response.text ? response.text() : "";
	}

	if (text?.length === 0) text = "Mejor comamos un poco de sushi! 🍣";
	if (natural.JaroWinklerDistance(text, prompt) > 0.8) text = ANTI_DUMBS_RESPONSES[Math.floor(Math.random() * ANTI_DUMBS_RESPONSES.length)];

	return { text, image, audio };
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

export function createChatEmbed(text: string, expertLevelAI: number = 0): EmbedBuilder {
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
		.setFooter({ text: expertLevelAI > 0 ? "✨ Modo Experto habilitado, respuesta generada con IA" : "♥" });
}

export function createImageEmbed(image: string): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(COLORS.pyeCutePink)
		.setAuthor({
			name: "PyE Chan",
			iconURL:
				"https://cdn.discordapp.com/attachments/1115058778736431104/1282790824744321167/vecteezy_heart_1187438.png?ex=66e0a38d&is=66df520d",
			url: "https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png",
		})
		.setDescription("Aquí tienes tu imagen 🧡")
		.setImage(image)
		.setTimestamp()
		.setFooter({ text: "♥" });
}
export function createAudioErrorEmbed(): EmbedBuilder {
	return new EmbedBuilder()
		.setColor(COLORS.warnOrange)
		.setAuthor({
			name: "PyE Chan",
			iconURL:
				"https://cdn.discordapp.com/attachments/1115058778736431104/1282790824744321167/vecteezy_heart_1187438.png?ex=66e0a38d&is=66df520d",
			url: "https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png",
		})
		.setDescription("Lo siento, comi demasiadas donas 🍩, no puedo hablar porque tengo la boca llena! Intenta denuevo mas tarde...")
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
