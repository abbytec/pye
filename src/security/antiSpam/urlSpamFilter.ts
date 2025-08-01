import { Message } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { SpamTracker } from "./spamTracker.js";

const urlTracker = new SpamTracker(5_000, 3);
const urlRegex = /https?:\/\/[^\s]+/g;

const normalizeUrl = (url: string) =>
	url
		.replace(/\?.*$/, "") // elimina query params
		.replace(/^https?:\/\//, "")
		.replace(/\/$/, "")
		.toLowerCase();

export async function checkUrlSpam(message: Message<boolean>, client: ExtendedClient) {
	if (!message.content.includes("http")) return false; // early exit

	const matches = message.content.match(urlRegex);
	if (!matches) return false; // no urls found

	// Optionally avoid duplicate URLs within a message
	const seen = new Set<string>();
	let triggered = false;

	for (const url of matches) {
		const norm = normalizeUrl(url);
		if (seen.has(norm)) continue;
		seen.add(norm);

		const key = `${message.author.id}-${norm}`;
		if (urlTracker.increment(key, message.createdTimestamp)) {
			triggered = true;
			await urlTracker.punish(message, client, "url", "Enviar el mismo enlace repetidamente se considera spam.");
		}
	}
	return triggered;
}
