// src/commands/Bumps/btop.ts
import { SlashCommandBuilder, User, Interaction, ButtonInteraction, Message } from "discord.js";
import client from "../../redis.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";
import { generateLeaderboard } from "../../utils/generic.js";
import { Bumps } from "../../Models/Bump.js";

const ITEMS_PER_PAGE = 10;
type Scope = "global" | "daily";

export default {
	group: "👤 - Perfiles (Casino)",
	data: new SlashCommandBuilder()
		.setName("btop")
		.setDescription("Muestra el top de usuarios con más bumps")
		.addStringOption((option) =>
			option
				.setName("scope")
				.setDescription("Elige el alcance del ranking")
				.addChoices({ name: "Global", value: "global" }, { name: "Diario", value: "daily" })
				.setRequired(false)
		),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand) => {
			let scope: Scope = (interaction.options.getString("scope") ?? "global") as Scope;
			let page = 1;

			const makeContent = async (disable = false) => {
				const { embed, actionRow, totalPages } = await buildLeaderboard(scope, page, interaction.user, interaction, disable);
				return { embeds: [embed], components: [actionRow], totalPages };
			};

			const initial = await makeContent();
			await replyInfo(interaction, initial.embeds, undefined, initial.components);

			const message = await interaction.fetchReply();
			if (!(message instanceof Message)) return;

			let totalPages = initial.totalPages;

			const collector = message.createMessageComponentCollector({
				filter: (i: Interaction) => i.isButton() && i.user.id === interaction.user.id && ["topBack", "topNext"].includes(i.customId),
				time: 60_000,
			});

			collector.on("collect", async (i: ButtonInteraction) => {
				if (i.customId === "topBack" && page > 1) page--;
				else if (i.customId === "topNext" && page < totalPages) page++;
				else {
					await i.deferUpdate();
					return;
				}

				const updated = await makeContent();
				totalPages = updated.totalPages;
				await i.update(updated);
			});

			collector.on("end", async () => {
				const disabled = await makeContent(true);
				await message.edit(disabled).catch(() => null);
			});
		},
		[]
	),
};

/**
 * Construye el leaderboard de bumps (global o diario).
 */
async function buildLeaderboard(scope: Scope, page: number, user: User, interaction: IPrefixChatInputCommand, disable = false) {
	let totalPages = 1;

	if (scope === "global") {
		const totalUsers = await Bumps.countDocuments();
		totalPages = Math.ceil(totalUsers / ITEMS_PER_PAGE) || 1;
		page = Math.min(Math.max(page, 1), totalPages);

		const { embed, actionRow } = await generateLeaderboard(page, user, disable, {
			title: "🏆 Top global de bumps",
			dataFetch: async () => Bumps.aggregate([{ $group: { _id: "$user", count: { $sum: 1 } } }]),
			sortFunction: (a: any, b: any) => b.count - a.count,
			positionFinder: (data: any[], id: string) => data.findIndex((u) => u._id === id),
			descriptionBuilder: async (item: any, index: number, start: number) => {
				const member = await interaction.guild?.members.fetch(item._id).catch(() => undefined);
				return `**${start + index + 1}.** [${member?.user.username ?? "Usuario Desconocido"}](https://discord.com/users/${
					item._id
				}) • ${item.count.toLocaleString()} bumps`;
			},
		});

		return { embed, actionRow, totalPages };
	}

	// Top diario (Redis)
	const totalUsers = await client.zCard("top:bump");
	totalPages = Math.ceil(Number(totalUsers) / ITEMS_PER_PAGE) || 1;
	page = Math.min(Math.max(page, 1), totalPages);

	const { embed, actionRow } = await generateLeaderboard(page, user, disable, {
		title: "📅 Top diario de bumps",
		dataFetch: async () => {
			const raw = await client.sendCommand<string[]>(["ZREVRANGE", "top:bump", "0", "-1", "WITHSCORES"]);
			const parsed: { _id: string; count: number }[] = [];
			for (let i = 0; i < raw.length; i += 2) parsed.push({ _id: raw[i], count: Number(raw[i + 1]) });
			return parsed;
		},
		sortFunction: (a: any, b: any) => b.count - a.count,
		positionFinder: async (_d: any, id: string) => {
			const rank = await client.zRevRank("top:bump", id);
			return rank ?? -1;
		},
		descriptionBuilder: async (item: any, index: number, start: number) => {
			const member = await interaction.guild?.members.fetch(item._id).catch(() => undefined);
			return `**${start + index + 1}.** [${member?.user.username ?? "Usuario Desconocido"}](https://discord.com/users/${
				item._id
			}) • ${item.count.toLocaleString()} bumps`;
		},
	});

	return { embed, actionRow, totalPages };
}
