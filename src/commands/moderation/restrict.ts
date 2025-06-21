import { SlashCommandBuilder, GuildMember, PermissionFlagsBits } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { getChannelFromEnv, getRoleFromEnv } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { ModLogs } from "../../Models/ModLogs.js";
import { updateRepRoles } from "../../composables/finalwares/updateRepRoles.js";
import { HelperPoint } from "../../Models/HelperPoint.js";

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("restrict")
		.setDescription("Restringir a un miembro.")
		.addUserOption((opt) => opt.setName("miembro").setDescription("Miembro a restringir").setRequired(true))
		.addStringOption((opt) =>
			opt
				.setName("type")
				.setDescription("Tipo de restricción")
				.setRequired(true)
				.addChoices([
					{ name: "Empleo", value: "empleo" },
					{ name: "Foros", value: "foros" },
				])
		)
		.addStringOption((opt) => opt.setName("motivo").setDescription("Motivo de la restricción").setRequired(false))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("miembro", true);
			const type = interaction.options.getString("type", true);
			const reason = interaction.options.getString("motivo") ?? "Ninguno";

			if (!user) return replyError(interaction, "Miembro no encontrado.");

			let roleId;
			if (type === "empleo") roleId = getRoleFromEnv(`restringido`);
			else if (type === "foros") {
				roleId = getRoleFromEnv(`restringido_foros`);
				let points = await HelperPoint.findOne({ _id: user.id });
				await points?.updateOne({ points: Math.floor(points.points * 0.1) });
			} else return replyError(interaction, "Tipo de restricción no reconocido.");

			const role = interaction.guild!.roles.cache.get(roleId);
			if (!role) return replyError(interaction, "Rol de restricción inexistente.");

			const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
			if (!member) return replyError(interaction, "Miembro no encontrado.");

			if (member.roles.cache.has(roleId)) return replyError(interaction, "El miembro ya está restringido.");

			await member.roles.add(role, `${reason} - Restringido por ${interaction.user.tag}`);

			await ModLogs.create({
				id: member.id,
				moderator: interaction.user.tag,
				reason,
				date: new Date(),
				type: "Restrict",
			});

			const msg =
				`Se ha restringido a **${member.user.tag}**. ` +
				(type === "foros" ? "En foros, se restó el 90% de sus puntos." : "En canales de empleo");

			await replyWarning(interaction, msg, undefined, undefined, undefined, undefined, false);

			const logChannelId = getChannelFromEnv("bansanciones");
			if (logChannelId)
				return {
					logMessages: [
						{
							channel: logChannelId,
							user: member.user,
							description: msg,
							fields: [
								{ name: "Razón", value: reason, inline: true },
								{ name: "Tipo", value: type, inline: true },
								{ name: "Moderador", value: interaction.user.tag, inline: true },
							],
						},
					],
				};
		},
		[updateRepRoles, logMessages]
	),
} as Command;
