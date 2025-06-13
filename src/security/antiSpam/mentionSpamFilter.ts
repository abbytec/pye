import { Collection, Message, Role, User } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { SpamTracker } from "./spamTracker.js";
const mentionTracker = new SpamTracker(5_000, 3);
export async function checkMentionSpam(message: Message<boolean>, client: ExtendedClient) {
	const mentions = new Collection<string, Role | User>([...message.mentions.users, ...message.mentions.roles]);
	if (message.reference?.messageId) {
		const ref = await message.channel.messages.fetch(message.reference.messageId).catch(() => null);
		if (ref) mentions.set(ref.author.id, ref.author);
	}

	for (const mentioned of mentions.values()) {
		const key = `${message.author.id}-${mentioned.id}`;
		if (mentionTracker.increment(key)) {
			await mentionTracker.punish(
				message,
				client,
				"Spam de menciones",
				"Mencionar tanto a una misma persona/bot puede traerte problemas. No seas bot, que para eso estoy yo!"
			);
			return true;
		}
	}
	return false;
}
