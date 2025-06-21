import { GuildMember, SlashCommandBuilder } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { updateRepRoles } from "../../composables/finalwares/updateRepRoles.js";
import { HelperPoint } from "../../Models/HelperPoint.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "🥳 - Puntos de reputación",
	data: new SlashCommandBuilder()
		.setName("remove-rep")
		.setDescription("Resta puntos de ayuda.")
		.addUserOption((option) => option.setName("usuario").setDescription("selecciona el usuario").setRequired(true))
		.addIntegerOption((option) => option.setName("cantidad").setDescription("cantidad de puntos").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "moderadorChats", "helper", "creadorDeRetos"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true);
			if (!user) return;
			const channel = interaction.channel;
			const amount = interaction.options.getInteger("cantidad") ?? 1;

			if (user.bot) return await replyError(interaction, "No puedo quitarle puntos a los bots.\nUso: `add-rep [@Usuario]`");
			const member = await interaction.guild?.members.fetch(user.id).catch(() => undefined);
			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			const data = await HelperPoint.findOneAndUpdate(
				{ _id: user.id, points: { $gt: 0 } },
				{ $inc: { points: -amount } },
				{ new: true, upsert: true }
			);

			if (!data) return replyError(interaction, "No se encontraron puntos para restar.");
			let repManager = interaction.member as GuildMember;
			const author =
				repManager.roles.cache.has(getRoleFromEnv("helper")) &&
				!repManager.roles.cache.has(getRoleFromEnv("moderadorChats")) &&
				!repManager.roles.cache.has(getRoleFromEnv("staff"))
					? null
					: undefined;
			await replyOk(interaction, `se le ha quitado **${amount == 1 ? "un" : amount}** rep al usuario: \`${user.tag}\``, author);

			return {
				guildMember: member,
				helperPoint: data,
				logMessages: [
					{
						channel: getChannelFromEnv("logPuntos"),
						content: `**${interaction.user.tag}** le ha quitado **${amount == 1 ? "un" : amount}** rep al usuario: \`${
							user.tag
						}\` en el canal: <#${channel?.id}>\n> *Puntos anteriores: ${data.points}. Puntos actuales: ${data.points - amount}*`,
					},
				],
			};
		},
		[updateRepRoles, logMessages]
	),
} as Command;
