import { Message } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { SpamTracker } from "./spamTracker.js";
const imageTracker = new SpamTracker(5_000, 3);
export async function checkAttachmentSpam(message: Message<boolean>, client: ExtendedClient) {
	let hasIMG = false;
	for (const [, attachment] of message.attachments) {
		if (hasIMG) break;
		if (attachment.contentType?.startsWith("image/") || attachment.contentType?.startsWith("video/")) {
			const key = `${message.author.id}-image`;
			if (imageTracker.increment(key)) {
				await imageTracker.punish(message, client, "attachment", "Enviar imágenes tantas veces seguidas se considera spam.");
				return true;
			}
		}
	}
	return false;
}
