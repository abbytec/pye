import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from "discord.js";
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

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("unrestrict")
		.setDescription("Quitar la restricción a un miembro.")
		.addUserOption((opt) => opt.setName("miembro").setDescription("Miembro a desrestringir").setRequired(true))
		.addStringOption((opt) =>
			opt.setName("type").setDescription("Tipo de restricción aplicada").setRequired(true).addChoices({ name: "Foros", value: "foros" })
		)
		.addStringOption((opt) => opt.setName("motivo").setDescription("Motivo de la desrestricción").setRequired(false))
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("miembro", true);
			const type = interaction.options.getString("type", true); // "foros", etc.
			const reason = interaction.options.getString("motivo") ?? "Ninguno";

			if (!user) return replyError(interaction, "Miembro no encontrado.");
			const member = await interaction.guild!.members.fetch(user.id).catch(() => null);
			if (!member) return replyError(interaction, "Miembro no encontrado.");

			let roleId;
			if (type === "empleo") roleId = getRoleFromEnv(`restringido`);
			else if (type === "foros") roleId = getRoleFromEnv(`restringido_foros`);
			else return replyError(interaction, "Tipo de restricción no reconocido.");
			if (!roleId) return replyError(interaction, "Rol de restricción no configurado.");
			const role = interaction.guild!.roles.cache.get(roleId);
			if (!role) return replyError(interaction, "Rol de restricción inexistente.");

			if (!member.roles.cache.has(roleId)) return replyError(interaction, "El miembro no está restringido.");

			await member.roles.remove(role, `${reason} - Desrestringido por ${interaction.user.tag}`);

			await ModLogs.findOneAndUpdate(
				{ id: member.id, type: "Restrict", hiddenCase: { $ne: true } },
				{
					$set: { hiddenCase: true, reasonUnpenalized: reason },
				}
			);

			const msg = `Se ha desrestringido a **${member.user.tag}**.`;

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
		[logMessages]
	),
} as Command;
