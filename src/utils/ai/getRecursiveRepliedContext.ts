import { Message } from "discord.js";
import { aiSecurityConstraint } from "./gemini.js";
import { getUserMemories } from "./userMemory.js";
import { getActualDateTime } from "./dmReminders.js";

const SYSTEM = "System: ";
export async function getRecursiveRepliedContext(
	message: Message<boolean>,
	pyeChan: boolean,
	maxDepth: number = 10,
	initialMessage?: string
): Promise<string> {
	const contextLines: string[] = [];
	let currentMessage: Message<boolean> | null = message;
	let depth = 0;
	const botName = pyeChan ? "PyE chan" : "PyE Bot";
	let finalMessage = "";

	while (currentMessage?.reference?.messageId && depth < maxDepth) {
		// Intenta obtener el mensaje referenciado
		const repliedMessage: Message | null = await message.channel.messages.fetch(currentMessage.reference.messageId).catch(() => null);

		if (!repliedMessage) break;
		// Determina el nombre del autor, reemplazando el nombre del bot si es necesario
		if (repliedMessage.author.id === (process.env.CLIENT_ID ?? "")) {
			contextLines.unshift(`${botName}: ${replaceBotMentions(botName, repliedMessage.embeds[0]?.description ?? repliedMessage.content)}`);
		} else {
			contextLines.unshift(`${repliedMessage.author.username}: ${replaceBotMentions(botName, repliedMessage.content)}`);
		}

		// Actualiza el mensaje actual para la siguiente iteración
		currentMessage = repliedMessage;
		depth++;
	}
	if (pyeChan) {
		const memories = getUserMemories(message.author.id);
		if (memories) {
			contextLines.unshift(`${message.author.username}: ${memories}`);
		}
		contextLines.unshift(`${SYSTEM}${getActualDateTime()}.\n${aiSecurityConstraint}`);
	}

	// Finalmente, añade el mensaje inicial al contexto
	const initialAuthorName = message.author.id === (process.env.CLIENT_ID ?? "") ? botName + ": " : message.author.username;

	if (initialMessage) contextLines.push(`${initialAuthorName}: ${replaceBotMentions(botName, initialMessage)}`);
	else contextLines.push(`${initialAuthorName}: ${replaceBotMentions(botName, message.content)}`);

	finalMessage += contextLines.join("\n");

	return finalMessage + "\n" + (botName + ": ");
}

function replaceBotMentions(botName: string, message: string = ""): string {
	const botId = process.env.CLIENT_ID;
	if (!botId) return message;

	const mentionRegex = new RegExp(`<@!?${botId}>`, "g");
	return message.replace(mentionRegex, botName);
}
