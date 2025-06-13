import { Message, TextChannel } from "discord.js";
import { ExtendedClient } from "../../client.js";

/* spamTracker.ts */
export class SpamTracker {
	private readonly map = new Map<string, { count: number; timeout: NodeJS.Timeout }>();

	constructor(private readonly windowMs: number, private readonly limit: number) {}

	increment(key: string): boolean {
		const entry = this.map.get(key);

		if (!entry) {
			this.map.set(key, {
				count: 1,
				timeout: setTimeout(() => this.map.delete(key), this.windowMs),
			});
			return false; // not yet spam
		}

		entry.count += 1;
		clearTimeout(entry.timeout); // refresh window
		entry.timeout = setTimeout(() => this.map.delete(key), this.windowMs);

		return entry.count >= this.limit; // true → spam
	}
	async punish(message: Message<boolean>, client: ExtendedClient, reason: string, warning: string) {
		const warnMsg = await (message.channel as TextChannel).send(`<@${message.author.id}> ${warning}`);

		const guild = client.guilds.cache.get(process.env.GUILD_ID ?? "") ?? client.guilds.resolve(process.env.GUILD_ID ?? "");
		await guild?.members.cache
			.get(message.author.id)
			?.timeout(45_000, reason)
			.catch(() => null);

		await message.delete().catch(() => null);
		setTimeout(() => warnMsg.delete().catch(() => null), 10_000);
	}
}
