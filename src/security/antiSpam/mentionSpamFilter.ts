import { Collection, Message, Role, User } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { SpamTracker } from "./spamTracker.js";
const mentionTracker = new SpamTracker(5_000, 3);
export async function checkMentionSpam(message: Message<boolean>, client: ExtendedClient) {
	const mentionedOnThisMessage = new Set<string>();
	const mentions = new Collection<string, Role | User>([...message.mentions.users, ...message.mentions.roles]);
	if (message.mentions.everyone) {
		const key = `${message.author.id}-everyone`;
		if (mentionTracker.increment(key, message.createdTimestamp)) {
			await mentionTracker.punish(
				message,
				client,
				"mention",
				"Mencionar a todos repetidamente no está permitido."
			);
			return true;
		}
	}
	
	if (message.reference?.messageId) {
		const ref = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
		if (ref) mentions.set(ref.author.id, ref.author);
	}

	for (const mentioned of mentions.values()) {
		const key = `${message.author.id}-${mentioned.id}`;
		if (mentionedOnThisMessage.has(key)) continue;
		mentionedOnThisMessage.add(key);
		if (mentionTracker.increment(key, message.createdTimestamp)) {
			await mentionTracker.punish(
				message,
				client,
				"mention",
				"Mencionar tanto a una misma persona/bot puede traerte problemas. No seas bot, que para eso estoy yo!"
			);
			return true;
		}
	}
	return false;
}
