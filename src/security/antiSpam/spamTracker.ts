import { Guild, Message, TextChannel } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";

/* spamTracker.ts */
export type SpamType = "message" | "url" | "attachment" | "mention";
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
	async punish(message: Message<boolean>, client: ExtendedClient, type: SpamType, warning: string) {
		const warnMsg = await (message.channel as TextChannel).send(`<@${message.author.id}> ${warning}`);

		const guild = client.guilds.cache.get(process.env.GUILD_ID ?? "") ?? client.guilds.resolve(process.env.GUILD_ID ?? "");
		await guild?.members.cache
			.get(message.author.id)
			?.timeout(45_000, getTimeoutReason(type))
			.catch(() => null);
		await message.delete().catch(() => null);
		setTimeout(() => warnMsg.delete().catch(() => null), 10_000);
		if (type === "url") {
			if (!!message.member?.joinedAt && Date.now() - message.member.joinedAt.getTime() < 60_000) {
				deleteAllMessagesFromAndKickUser(message, guild);
				return;
			} else {
				(guild?.channels.cache.get(getChannelFromEnv("moderadores")) as TextChannel | undefined)?.send(
					`<@${message.author.id}> spameó urls, por favor revisar!`
				);
			}
		}
	}
}

function getTimeoutReason(type: SpamType): string {
	switch (type) {
		case "message":
			return "Spam de mensajes";
		case "url":
			return "Spam de URLs";
		case "attachment":
			return "Spam de archivos";
		case "mention":
			return "Spam de menciones";
	}
}

const deletingMessageMembers = new Set<string>();

export async function deleteAllMessagesFromAndKickUser(message: Message<boolean>, guild: Guild | null) {
	if (deletingMessageMembers.has(message.author.id)) return;
	deletingMessageMembers.add(message.author.id);
	// 1 — borra mensajes recientes del user en **todos** los canales de texto
	for (const [, ch] of guild?.channels.cache ?? []) {
		if (!ch.isTextBased()) continue;
		const msgs = await (ch as TextChannel).messages.fetch({ limit: 25 }).catch(() => null);
		const own = msgs?.filter((m) => m.author.id === message.author.id);
		if (own?.size) await (ch as TextChannel).bulkDelete(own, true).catch(() => null);
	}
	// 2 — DM y 3 — kick
	await message.author.send("Fuiste expulsado por spam de URLs. Si creés que es un error, contactá a un moderador.").catch(() => null);
	await message.member
		?.kick("Spam de URLs (usuario recién unido)")
		.then(() =>
			(guild?.channels.cache.get(getChannelFromEnv("moderadores")) as TextChannel | undefined)?.send({
				content: `Se kickeo a ${message.author.username} <@${message.author.id}> por entrar al sv a spamear links.\n`,
				embeds: [
					{
						title: "Contenido del ultimo mensaje",
						description: `${message.content}`,
						color: COLORS.warnOrange,
						footer: { text: "(En sus primeros 60 segundos en el SV)" },
					},
				],
			})
		)
		.catch(() => null);
}
