import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { COLORS } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	data: new SlashCommandBuilder()
		.setName("avatar")
		.setDescription("Muestra el avatar de un usuario")
		.addUserOption((option) => option.setName("usuario").setDescription("menciona a un usuario").setRequired(true)),
	async execute(interaction: IPrefixChatInputCommand) {
		const user = await interaction.options.getUser("usuario", true);
		if (!user) return;

		const embed = new EmbedBuilder()
			.setColor(COLORS.pyeLightBlue)
			.setTitle(`Avatar de ${user.username}`)
			.addFields([
				{
					name: "❥╏Links",
					value: `[Google](https://lens.google.com/uploadbyurl?url=${user.displayAvatarURL({
						size: 1024,
					})}) | [JPG](${user.displayAvatarURL({ size: 1024 })})`,
				},
			])
			.setImage(user.displayAvatarURL({ size: 1024 }))
			.setFooter({ text: `ID de ${user.username}: ${user.id}` });

		interaction.reply({ embeds: [embed] });
	},
} as Command;
