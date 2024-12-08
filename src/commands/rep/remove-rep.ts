import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.js";
import { updateRepRoles } from "../../utils/finalwares/updateRepRoles.js";
import { HelperPoint } from "../../Models/HelperPoint.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "🥳 - Puntos de reputación",
	data: new SlashCommandBuilder()
		.setName("remove-rep")
		.setDescription("Resta puntos de ayuda.")
		.addUserOption((option) => option.setName("usuario").setDescription("selecciona el usuario").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "repatidorDeRep"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true);
			const channel = interaction.channel;

			if (user.bot) return await replyError(interaction, "No puedo quitarle puntos a los bots.\nUso: `add-rep [@Usuario]`");
			const member = await interaction.guild?.members.fetch(user.id);
			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			let data = await HelperPoint.findOneAndUpdate(
				{ _id: user.id, points: { $gt: 0 } },
				{ $inc: { points: -1 } },
				{ new: true, upsert: true }
			);

			if (!data) return replyError(interaction, "No se encontraron puntos para restar.");

			await replyOk(interaction, `se le ha quitado un rep al usuario: \`${user.tag}\``);

			return {
				guildMember: member,
				helperPoint: data,
				logMessages: [
					{
						channel: getChannelFromEnv("logPuntos"),
						content: `**${interaction.user.tag}** le ha quitado un rep al usuario: \`${user.tag}\` en el canal: <#${channel?.id}>`,
					},
				],
			};
		},
		[updateRepRoles, logMessages]
	),
} as Command;
