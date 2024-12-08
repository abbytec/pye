import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	data: new SlashCommandBuilder().setName("ping").setDescription("Pong!"),

	async execute(interaction: IPrefixChatInputCommand) {
		// Enviar la respuesta "Pong!"
		await interaction.reply("Pong!");
	},
} as Command;
