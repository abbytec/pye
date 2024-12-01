import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { ExtendedClient } from "../../client.js";

export default {
	data: new SlashCommandBuilder()
		.setName("report")
		.setDescription("Reporte de top3 (emojis, stickers y foros) en tendencia, en decadencia y no utilizados!"),

	async execute(interaction: ChatInputCommandInteraction) {
		await interaction.reply({ embeds: [ExtendedClient.trending.getStats()] });
	},
};
