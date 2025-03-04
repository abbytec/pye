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
	let contextLines: string[] = [];
	let currentMessage: Message<boolean> | null = message;
	let depth = 0;
	const botName = pyeChan ? "PyE chan: " : "PyE Bot: ";
	let finalMessage = "";
	if (pyeChan) {
		const memories = getUserMemories(message.author.id);
		if (memories) {
			contextLines.unshift(`${message.author.username}: ${memories}`);
		}
		contextLines.unshift(`${SYSTEM}${getActualDateTime()}`);
	}
	while (currentMessage?.reference?.messageId && depth < maxDepth) {
		// Intenta obtener el mensaje referenciado
		const repliedMessage: Message | null = await message.channel.messages.fetch(currentMessage.reference.messageId).catch(() => null);

		if (!repliedMessage) break;
		// Determina el nombre del autor, reemplazando el nombre del bot si es necesario
		if (repliedMessage.author.id === (process.env.CLIENT_ID ?? "")) {
			contextLines.unshift(`${botName}${repliedMessage.content || repliedMessage.embeds[0]?.description}`);
		} else {
			contextLines.unshift(`${repliedMessage.author.username}: ${repliedMessage.content}`);
		}

		// Actualiza el mensaje actual para la siguiente iteración
		currentMessage = repliedMessage;
		depth++;
	}

	// Finalmente, añade el mensaje inicial al contexto
	const initialAuthorName = message.author.id === (process.env.CLIENT_ID ?? "") ? botName : message.author.username;

	if (initialMessage) contextLines.push(`${initialAuthorName}: ${initialMessage}`);
	else contextLines.push(`${initialAuthorName}: ${message.content}`);

	// Combina todas las líneas en una sola cadena de texto
	contextLines = contextLines.reverse();

	finalMessage += contextLines.join("\n");

	return finalMessage + "\n" + SYSTEM + aiSecurityConstraint + "\n" + botName;
}
