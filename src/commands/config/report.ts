import { SlashCommandBuilder } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import TrendingService from "../../core/services/TrendingService.js";

export default {
	group: "⚙️ - Administración - General",
	data: new SlashCommandBuilder()
		.setName("report")
		.setDescription("Reporte de top3 (emojis, stickers y foros) en tendencia, en decadencia y no utilizados!"),

	async execute(interaction: IPrefixChatInputCommand) {
		await interaction.reply({ embeds: [await interaction.client.services.trending.getStats(interaction.client)] });
	},
} as Command;
