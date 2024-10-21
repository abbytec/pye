import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getChannelFromEnv, getRoles } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { updateRepRoles } from "../../utils/finalwares/updateRepRoles.ts";
import { HelperPoint } from "../../Models/HelperPoint.ts";
import { replyOkToMessage, logMessages } from "../../utils/finalwares/sendFinalMessages.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("remove-rep")
		.setDescription("Resta puntos de ayuda.")
		.addUserOption((option) => option.setName("usuario").setDescription("selecciona el usuario").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "repatidorDeRep"), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const user = interaction.options.getUser("usuario", true);

			if (user.bot) return await replyError(interaction, "No puedo quitarle puntos a los bots.\nUso: `add-rep [@Usuario]`");
			const member = await interaction.guild?.members.fetch(user.id);
			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			let data = await HelperPoint.findOne({ _id: user.id }).exec();

			if (!data) data = await HelperPoint.create({ _id: user.id });
			data.points -= 1;
			let newData = await data.save();

			return {
				guildMember: member,
				helperPoint: newData,
				logMessages: [
					{
						channel: getChannelFromEnv("logPuntos"),
						content: `**${interaction.user.tag}** le ha quitado un rep al usuario: \`${user.tag}\``,
					},
				],
				reactOkMessage: `se le ha quitado un rep al usuario: \`${user.tag}\``,
			};
		},
		[updateRepRoles, logMessages, replyOkToMessage]
	),
};
