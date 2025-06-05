import { Sticker, StickerType, TextChannel, ChannelType, EmbedBuilder } from "discord.js";
import { CoreClient } from "./CoreClient.js";
import Trending from "../Models/Trending.js";
import { MemeOfTheDay } from "../Models/MemeOfTheDay.js";
import { COLORS, getChannelFromEnv } from "../utils/constants.js";

export class TrendingService {
	public static readonly trending = new Trending();
	private static readonly stickerTypeCache = new Map<string, StickerType>();

	constructor(private readonly client: CoreClient) {}

	async loadGuildData() {
		const guild = await this.client.guilds.fetch(process.env.GUILD_ID!);
		/* emojis */
		console.log("loading emojis");
		const emojis = (await guild.emojis.fetch()).map((e) => (e.name ?? "_") + ":" + e.id).filter((emoji) => emoji) ?? [];
		/* stickers */
		console.log("loading stickers");
		const stickers = (await guild.stickers.fetch()).map((s) => s.id).filter((sticker) => sticker) ?? [];
		/* forums */
		console.log("loading forum channels");
		const forums =
			(await guild.channels.fetch().catch(() => undefined))
				?.filter((channel) => channel?.type === ChannelType.GuildForum && channel?.parent?.id === getChannelFromEnv("categoryForos"))
				.filter((channel) => channel != null)
				.map((c) => c.id) ?? [];
		TrendingService.trending.load(emojis, stickers, forums);
	}

	public static async getStickerType(sticker: Sticker) {
		if (!TrendingService.stickerTypeCache.has(sticker.id))
			await sticker.fetch().then((sticker) => {
				TrendingService.stickerTypeCache.set(sticker.id, sticker.type ?? StickerType.Guild);
			});
		return TrendingService.stickerTypeCache.get(sticker.id)!;
	}

	async starboardMemeOfTheDay() {
		const top = await MemeOfTheDay.getTopReaction();
		if (!top || top.count <= 4) return;
		const embed = new EmbedBuilder()
			.setAuthor({
				name: "Meme del día",
				iconURL:
					"https://cdn.discordapp.com/attachments/1115058778736431104/1282790824744321167/vecteezy_heart_1187438.png?ex=66e0a38d&is=66df520d",
			})
			.setDescription(`Subido por **${top.username}** [(ir al meme)](${top.messageUrl})`)
			.setImage(top.url)
			.setFooter({ text: `💬 ${top.count} reacciones` })
			.setColor(COLORS.pyeLightBlue);

		const channel = guildChannel(this.client, getChannelFromEnv("starboard"));
		channel?.send({ embeds: [embed] }).then(() => MemeOfTheDay.resetCount());
	}

	public async dailySave() {
		await TrendingService.trending.dailySave();
	}
}

function guildChannel(client: CoreClient, id: string) {
	return client.guilds.cache.get(process.env.GUILD_ID!)?.channels.resolve(id) as TextChannel | undefined;
}
