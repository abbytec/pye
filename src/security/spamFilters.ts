import { Message, GuildMember, TextChannel, User, ForumChannel, MediaChannel, NewsChannel, Guild, Collection, Role } from "discord.js";
import { ExtendedClient } from "../client.js";
import { applyTimeout } from "../commands/moderation/timeout.js";
import { COLORS, getChannelFromEnv } from "../utils/constants.js";

export interface IFilter {
	filter: RegExp;
	mute: boolean;
	staffWarn?: string;
}

const linkPeligroso = "Posible link peligroso detectado";
export const spamFilterList: IFilter[] = [
	{ filter: /\w+\.xyz$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.click$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.info$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.ru$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.biz$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.online$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /\w+\.club$/i, mute: false, staffWarn: linkPeligroso },
	{ filter: /(https?:\/\/)?(t\.me|telegram\.me|wa\.me|whatsapp\.me)\/.+/i, mute: true },
	{ filter: /(https?:\/\/)?(pornhub\.\w+|xvideos\.com|xhamster\.com|xnxx\.com|hentaila.\w+)\/.+/i, mute: true },
	{
		filter: /(?!(https?:\/\/)?discord\.gg\/programacion$)(https?:\/\/)?discord\.gg\/.+/i,
		mute: true,
	},
	{
		filter: /(?!(https?:\/\/)?discord\.com\/invite\/programacion$)(https?:\/\/)?discord\.com\/invite\/.+/i,
		mute: true,
	},
	{ filter: /(https?:\/\/)?steamcommunity\.com\/gift\/.+/i, mute: false },
	{ filter: /https?:\/\/(www\.)?\w*solara\w*\.\w+\/?/i, mute: true },
	{
		filter: /(?=.*(?:eth|ethereum|btc|bitcoin|capital|crypto|memecoins|nitro|\$|nsfw))(?=.*\b(?:gana\w*|gratis|multiplica\w*|inver\w*|giveaway|server|free)\b).*/is,
		mute: false,
		staffWarn: "Posible estafa detectada",
	},
];

export interface IDeletableContent {
	id: string;
	guild: Guild; // esto es para que funcione el delete, porque si no el this no me lo permite
	channel: NewsChannel | TextChannel | ForumChannel | MediaChannel | null;
	delete: (reason: string) => Promise<any>;
}

export async function spamFilter(author: GuildMember | null, client: ExtendedClient, deletable: IDeletableContent, messageContent = "") {
	if (!author || messageContent.length < 8) return false;

	const detectedFilter = spamFilterList.find((item) => item.filter.test(messageContent));

	if (detectedFilter && !detectedFilter.staffWarn) {
		try {
			await deletable.delete("Spam Filter");
			if (detectedFilter.mute)
				applyTimeout(
					10000,
					"Spam Filter",
					author,
					client.guilds.cache.get(process.env.GUILD_ID ?? "")?.iconURL({ extension: "gif" }) ?? null
				);
			console.log("Mensaje borrado que contenía texto en la black list");
		} catch (error) {
			console.error("spamFilter: Error al intentar borrar el mensaje:", error);
		}

		const logChannel = (client.channels.cache.get(getChannelFromEnv("logs")) ??
			client.channels.resolve(getChannelFromEnv("logs"))) as TextChannel | null;

		await logChannel
			?.send({
				embeds: [
					{
						title: "Spam Filter",
						description: "Se eliminó un mensaje que contenía texto no permitido.",
						fields: [
							{ name: "Usuario", value: `<@${author.id}> (${author.user.id})`, inline: false },
							{ name: "Spam Triggered", value: `\`${detectedFilter.filter}\`\nEn canal: ${deletable.channel}`, inline: false },
						],
						color: COLORS.warnOrange,
						timestamp: "2024-04-27T12:00:00.000Z",
					},
				],
			})
			.catch((err) => console.warn("spamFilter: Error al intentar enviar el log.", err));
	} else if (detectedFilter?.staffWarn) {
		const moderatorChannel = (client.channels.cache.get(getChannelFromEnv("moderadores")) ??
			client.channels.resolve(getChannelFromEnv("moderadores"))) as TextChannel | null;
		const messageLink = deletable.channel
			? `https://discord.com/channels/${process.env.GUILD_ID}/${deletable.channel.id}/${deletable.id}`
			: "";
		await moderatorChannel
			?.send({
				content: `**Advertencia:** ${detectedFilter.staffWarn}. ${messageLink}`,
			})
			.catch((err) => console.error("spamFilter: Error al enviar el mensaje de advertencia:", err));
	}
	return detectedFilter;
}

const mentionTracker = new Map();
export async function checkMentionSpam(message: Message<boolean>, client: ExtendedClient) {
	const mentions = new Collection<string, User | Role>(message.mentions.users).concat(message.mentions.roles);
	const authorId = message.author.id;

	let deleted = false;

	mentions.forEach(async (mentionedUser) => {
		const mentionedId = mentionedUser.id;
		const key = `${authorId}-${mentionedId}`;

		if (!mentionTracker.has(key)) {
			mentionTracker.set(key, {
				count: 1,
				timeout: setTimeout(() => {
					mentionTracker.delete(key);
				}, 5000),
			});
		} else {
			const entry = mentionTracker.get(key);
			entry.count += 1;

			if (entry.count >= 3) {
				clearTimeout(entry.timeout);
				let warn = await (message.channel as TextChannel).send({
					content: `<@${message.author.id}> Mencionar tanto a una misma persona puede traerte problemas. No seas bot, que para eso estoy yo!`,
				});
				let guild = client.guilds.cache.get(process.env.GUILD_ID ?? "") ?? client.guilds.resolve(process.env.GUILD_ID ?? "");
				let member = guild?.members.cache.get(message.author.id) ?? guild?.members.resolve(message.author.id);
				await member?.timeout(45000, "Spam de menciones").catch(() => null);
				await message.delete().catch(() => null);
				mentionTracker.set(key, {
					count: entry.count,
					timeout: setTimeout(() => {
						mentionTracker.delete(key);
					}, 5000),
				});

				setTimeout(() => warn.delete().catch(() => null), 10000);
				deleted = true;
			}
		}
	});

	return deleted;
}
