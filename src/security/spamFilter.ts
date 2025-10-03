import { GuildMember, Message, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.js";
import { applyTimeout } from "../commands/moderation/timeout.js";
import { getChannelFromEnv, COLORS } from "../utils/constants.js";
import { IDeletableContent } from "./messageGuard.js";
import { SpamTracker } from "./antiSpam/spamTracker.js"; // ruta donde ya la tengas
const floodTracker = new SpamTracker(60_000, 3);
export interface IFilter {
	filter: RegExp;
	mute: boolean | "checkinvite";
	staffWarn?: string;
}

const vanity = "programacion";

const linkSospechoso = "Link sospechoso detectado";
const spamBot = "Spam bot detectado";
export const spamFilterList: IFilter[] = [
	{ filter: /https?:\/\/[\w.-]+\.xyz($|\W)/i, mute: false, staffWarn: linkSospechoso },
	{ filter: /https?:\/\/[\w.-]+\.click($|\W)/i, mute: false, staffWarn: linkSospechoso },
	{ filter: /https?:\/\/[\w.-]+\.info($|\W)/i, mute: false, staffWarn: linkSospechoso },
	{ filter: /https?:\/\/[\w.-]+\.ru($|\W)/i, mute: false, staffWarn: linkSospechoso },
	{ filter: /https?:\/\/[\w.-]+\.biz($|\W)/i, mute: false, staffWarn: linkSospechoso },
	{ filter: /https?:\/\/[\w.-]+\.online($|\W)/i, mute: false, staffWarn: linkSospechoso },
	{ filter: /https?:\/\/[\w.-]+\.club($|\W)/i, mute: false, staffWarn: linkSospechoso },
	{ filter: /(https?:\/\/)?(t\.me|telegram\.me|wa\.me|whatsapp\.me)\/.+/i, mute: true },
	{ filter: /(https?:\/\/)?(pornhub|xvideos|xhamster|xnxx|hentaila)(\.\S+)+\//i, mute: true },
	{
		filter: new RegExp(`(?!(https?:\\/\\/)?(?:www\\.)?(?:discord\\.gg\\/${vanity}|discord(?:app)?\\.com\\/invite\\/${vanity}))` +
							  `(https?:\\/\\/)?(?:www\\.)?(?:discord\\.gg\\/[^\\s\\/]+|discord(?:app)?\\.com\\/invite\\/[^\\s\\/]+)`, "i"),
		mute: "checkinvite",
	},
	{
		filter: /(https?:\/\/)?multiigims.netlify.app/i,
		mute: true,
	},
	{ filter: /\[.*?steamcommunity\.com\/.*\]/i, mute: true },
	{ filter: /https?:\/\/(www\.)?\w*solara\w*\.\w+\/?/i, mute: true, staffWarn: spamBot },
	{
		filter: /(?:solara|wix)(?=.*\broblox\b)(?=.*(?:executor|free)).*/is,
		mute: true,
		staffWarn: spamBot,
	},
	{
		filter: /(?:https?:\/\/(?:www\.)?|www\.)?outlier\.ai\b/gi,
		mute: true,
		staffWarn: spamBot,
	},
	{
		filter: /(?=.*\b(eth|ethereum|btc|bitcoin|capital|crypto|memecoins|nitro|\$|nsfw)\b)(?=.*\b(gana\w*|gratis|multiplica\w*|inver\w*|giveaway|server|free|earn)\b)/is,
		mute: false,
		staffWarn: "Posible estafa detectada",
	},
];

const validInvites: string[] = [
	"1324546600533626951", // pyecraft
	"1399938376442052691", // Server de apelaciónes
	process.env.GUILD_ID ?? "",
];

const INVISIBLE_CHARS = /[\u2000-\u200B\u2028\u205F\u3000\u00A0]/g;

function sanitize(content: string): string {
	return content.replace(INVISIBLE_CHARS, "");
}

async function deleteAndTimeout(author: GuildMember, deletable: IDeletableContent, client: ExtendedClient) {
	await deletable.delete("Spam Filter").catch(() => null);
	await applyTimeout(
		10000,
		"Spam Filter",
		author,
		client.guilds.cache.get(process.env.GUILD_ID ?? "")?.iconURL({ extension: "gif" }) ?? null
	).catch(() => null);
}

async function isInviteAllowed(inviteUrl: string, client: ExtendedClient): Promise<boolean> {
	try {
		const invite = await client.fetchInvite(inviteUrl);
		return validInvites.includes(invite.guild?.id ?? "");
	} catch {
		return false;
	}
}

async function logDeletion(
	client: ExtendedClient,
	detectedFilter: IFilter,
	author: GuildMember,
	deletable: IDeletableContent,
	content: string
): Promise<string | null> {
	const messagesChannel = (client.channels.cache.get(getChannelFromEnv("logMessages")) ??
		client.channels.resolve(getChannelFromEnv("logMessages"))) as TextChannel | null;

	const msg = await messagesChannel
		?.send({
			embeds: [
				{
					title: "Spam Filter",
					description: "Se eliminó un mensaje que contenía texto no permitido.",
					fields: [
						{ name: "Usuario", value: `<@${author.id}> (${author.user.id})`, inline: false },
						{
							name: "Spam Triggered",
							value: `\`${detectedFilter.filter}\`\nEn: ${
								detectedFilter.mute ? "<#" + deletable.channel?.id + ">" : deletable.url
							}`,
							inline: false,
						},
						{
							name: "Contenido (recortado a 150 caracteres)",
							value: `\`\`\`\n${content.slice(0, 150)}\n\`\`\``,
							inline: false,
						},
					],
					color: COLORS.warnOrange,
					timestamp: new Date().toISOString(),
				},
			],
		})
		.catch(() => console.error("No se pudo enviar el log de mensajes"));

	return msg?.url ?? null;
}

async function warnModerators(client: ExtendedClient, warning: string, referenceUrl: string | null) {
	const moderatorChannel = (client.channels.cache.get(getChannelFromEnv("moderadores")) ??
		client.channels.resolve(getChannelFromEnv("moderadores"))) as TextChannel | null;

	await moderatorChannel
		?.send({
			content: `**Advertencia:** ${warning}. ${referenceUrl ?? ""}`,
		})
		.catch((err) => console.error("spamFilter: Error al advertir al staff:", err));
}

export async function spamFilter(author: GuildMember | null, client: ExtendedClient, deletable: IDeletableContent, messageContent = "") {
	if (!author || messageContent.length < 8) return false;

	const sanitized = sanitize(messageContent);
	const triggered = spamFilterList.filter(({ filter }) => filter.test(sanitized));

	let blocked = false;
	let loggedUrl: string | null = null;

	for (const rule of triggered) {
		switch (rule.mute) {
			case "checkinvite": {
				const invite = rule.filter.exec(messageContent)?.[0];
				if (invite && !(await isInviteAllowed(invite, client))) {
					await deleteAndTimeout(author, deletable, client);
					blocked = true;
				}
				break;
			}
			case true:
				await deleteAndTimeout(author, deletable, client);
				blocked = true;
				break;
			case false:
				if (floodTracker.increment(author.id, deletable.createdTimestamp)) {
					await floodTracker.punish(
						deletable as Message<boolean>, // o adaptá el tipo
						client,
						"message",
						"Evita enviar enlaces repetidos"
					);
					blocked = true;
				}
				break;
		}

		if (blocked) {
			loggedUrl = await logDeletion(client, rule, author, deletable, messageContent);
		}

		if (rule.staffWarn) {
			await warnModerators(
				client,
				rule.staffWarn,
				loggedUrl ??
					(deletable.channel ? `https://discord.com/channels/${process.env.GUILD_ID}/${deletable.channel.id}/${deletable.id}` : "")
			);
		}
	}

	return blocked;
}
