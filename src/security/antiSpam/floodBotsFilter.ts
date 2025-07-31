import { Message } from "discord.js";
import { SpamTracker } from "./spamTracker.js";
import { ExtendedClient } from "../../client.js";

const floodTracker = new SpamTracker(6_000, 3);

export async function floodBotsFilter(message: Message<boolean>, client: ExtendedClient) {
	// Solo mensajes normales (sin embeds, sin adjuntos, etc)
	const joinedAt = message.member?.joinedAt;
	if (joinedAt && Date.now() - joinedAt.getTime() < 60_000) {
		const trimmed = (message.content || "").slice(0, 150).trim().replace(/\s+/g, " ");
		if (!trimmed) return false;

		const safeContent = encodeURIComponent(trimmed);
		const key = `flood-${message.author.id}-${safeContent}`;

		if (floodTracker.increment(key, message.createdTimestamp)) {
			await floodTracker.punish(message, client, "newFloodMessage", "Flood de mensajes de bots.");
			return true;
		}
	}
	return false;
}
