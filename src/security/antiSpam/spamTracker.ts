import { Guild, Message, TextChannel } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";

/* spamTracker.ts */
export type SpamType = "message" | "url" | "attachment" | "mention" | "newFloodMessage";
const punishingUser = new Set<string>();
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
		if ((type === "url" || type === "newFloodMessage") && !punishingUser.has(message.author.id)) {
			punishingUser.add(message.author.id);
			if (!!message.member?.joinedAt && Date.now() - message.member.joinedAt.getTime() < 60_000) {
				deleteAllMessagesFromAndKickUser(message, guild, type);
				return;
			} else {
				(guild?.channels.cache.get(getChannelFromEnv("moderadores")) as TextChannel | undefined)?.send(
					`<@${message.author.id}> spameó urls, por favor revisar!`
				);
			}
			setTimeout(() => punishingUser.delete(message.author.id), 10_000);
		}
		(guild?.channels.cache.get(getChannelFromEnv("logMessages")) as TextChannel | undefined)?.send({
			embeds: [
				{
					title: "Spam Filter",
					description: `Se eliminó un mensaje de <@${message.author.id}> (${message.author.id}) en <#${
						message.channel.id
					}>. Razón ${getTimeoutReason(type)}`,
					color: COLORS.errRed,
					fields: [
						{
							name: "Contenido (recortado a 150 caracteres)",
							value: message.content.slice(0, 150),
						},
					],
				},
			],
		});
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
		case "newFloodMessage":
			return "Spam de mensajes";
	}
}

export async function deleteAllMessagesFromAndKickUser(message: Message<boolean>, guild: Guild | null, type: SpamType) {
	// 1 — borra mensajes recientes del user en **todos** los canales de texto
	for (const [, ch] of guild?.channels.cache ?? []) {
		if (!ch.isTextBased()) continue;
		const msgs = await (ch as TextChannel).messages.fetch({ limit: 25 }).catch(() => null);
		const own = msgs?.filter((m) => m.author.id === message.author.id);
		if (own?.size) await (ch as TextChannel).bulkDelete(own, true).catch(() => null);
	}
	// 2 — DM y 3 — kick
	await message.author
		.send(
			`Fuiste expulsado por ${getTimeoutReason(
				type
			)}. Si creés que es un error, contactá a un moderador.\n Puedes **apelar** en el siguiente enlace:\n` +
				`👉 [Apela aquí](https://discord.gg/F8QxEMtJ3B)`
		)
		.catch(() => null);
	await message.member
		?.kick(`${getTimeoutReason(type)} (usuario recién unido)`)
		.then(() =>
			(guild?.channels.cache.get(getChannelFromEnv("moderadores")) as TextChannel | undefined)?.send({
				content: `Se kickeo a ${message.author.username} <@${message.author.id}> por entrar al sv y hacer ${getTimeoutReason(type)}.\n`,
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
