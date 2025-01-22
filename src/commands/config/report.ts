import { SlashCommandBuilder } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "⚙️ - Administración - General",
	data: new SlashCommandBuilder()
		.setName("report")
		.setDescription("Reporte de top3 (emojis, stickers y foros) en tendencia, en decadencia y no utilizados!"),

	async execute(interaction: IPrefixChatInputCommand) {
		await interaction.reply({ embeds: [await ExtendedClient.trending.getStats(interaction.client)] });
	},
} as Command;
