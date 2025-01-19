// src/commands/Moderation/restrict.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { COLORS, getChannelFromEnv, getRoleFromEnv } from "../../utils/constants.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("restrict")
		.setDescription("Ver o editar el estado de restricción de un miembro.")
		// Subcomando: view
		.addSubcommand((subcommand) =>
			subcommand
				.setName("view")
				.setDescription("Verificar si un miembro está restringido.")
				.addUserOption((option) => option.setName("miembro").setDescription("El miembro a verificar.").setRequired(true))
		)
		// Subcomando: toggle
		.addSubcommand((subcommand) =>
			subcommand
				.setName("toggle")
				.setDescription("Restringir/desrestringir a un miembro por rol.")
				.addUserOption((option) => option.setName("miembro").setDescription("El miembro a restringir/desrestringir.").setRequired(true))
				.addStringOption((option) =>
					option.setName("motivo").setDescription("El motivo de la restricción/desrestricción.").setRequired(false)
				)
		)
		// Configuración de permisos: solo usuarios con 'Manage Roles' pueden usar 'toggle'
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const subcommand = interaction.options.getSubcommand();
			const memberUser = await interaction.options.getUser("miembro").catch(() => null);

			if (!memberUser) {
				return await replyError(interaction, "No se pudo encontrar al miembro especificado.");
			}

			const guildMember = await interaction.guild?.members.fetch(memberUser.id).catch(() => null);

			if (!guildMember) {
				return await replyError(interaction, "El miembro especificado no está en este servidor.");
			}

			switch (subcommand) {
				case "view":
					return await handleView(interaction, guildMember);
				case "toggle":
					return await handleToggle(interaction, guildMember);
				default:
					return await replyError(interaction, "Subcomando no reconocido.");
			}
		},
		[logMessages]
	),
} as Command;

/**
 * Maneja el subcomando 'view' para verificar el estado de restricción.
 */
async function handleView(interaction: IPrefixChatInputCommand, member: GuildMember): Promise<void> {
	try {
		const restrictedRoleId = getRoleFromEnv("restringido");
		const hasRestrictedRole = restrictedRoleId ? member.roles.cache.has(restrictedRoleId) : false;
		const restrictedRole = interaction.guild?.roles.cache.get(restrictedRoleId);

		let description = "**Restringido por Rol:** " + (hasRestrictedRole ? `Sí (${restrictedRole?.name})` : "No");

		const embed = new EmbedBuilder()
			.setAuthor({
				name: interaction.client.user?.tag ?? "Bot",
				iconURL: interaction.client.user?.displayAvatarURL() ?? "",
			})
			.setTitle(`Estado de Restricción de ${member.user.tag}`)
			.setDescription(description)
			.setTimestamp();

		embed.setColor(hasRestrictedRole ? COLORS.warnOrange : COLORS.okGreen);

		await replyOk(interaction, [embed]);
	} catch (error) {
		console.error("Error al verificar el estado de restricción:", error);
		await replyError(interaction, "Hubo un error al verificar el estado de restricción.");
	}
}

/**
 * Maneja el subcomando 'toggle' para restringir/desrestringir por rol.
 */
async function handleToggle(interaction: IPrefixChatInputCommand, member: GuildMember): Promise<PostHandleable | void> {
	try {
		const restrictedRoleId = getRoleFromEnv("restringido");

		if (!restrictedRoleId) {
			return await replyError(interaction, "El rol de restricción no está configurado correctamente.");
		}

		const restrictedRole = interaction.guild?.roles.cache.get(restrictedRoleId);

		if (!restrictedRole) {
			return await replyError(interaction, "El rol de restricción no existe en este servidor.");
		}

		const reason = interaction.options.getString("motivo") ?? "Ninguno";

		const hasRestrictedRole = member.roles.cache.has(restrictedRoleId);
		let action: "Restringido" | "Desrestringido";
		let message: string;

		if (hasRestrictedRole) {
			// Desrestringir
			await member.roles.remove(restrictedRole, `${reason} - Desrestringido por ${interaction.user.tag}`);
			action = "Desrestringido";
			message = `Se ha ${action.toLowerCase()} a: **${member.user.tag}**.`;
		} else {
			// Restringir
			await member.roles.add(restrictedRole, `${reason} - Restringido por ${interaction.user.tag}`);
			action = "Restringido";
			message = `Se ha ${action.toLowerCase()} a: **${member.user.tag}**.`;
		}
		await replyWarning(interaction, message, undefined, undefined, undefined, undefined, false);
		const logChannelId = getChannelFromEnv("bansanciones");
		if (logChannelId) {
			return {
				logMessages: [
					{
						channel: logChannelId,
						user: member.user,
						description: message,
						fields: [
							{ name: "Razón", value: reason, inline: true },
							{ name: "\u200b", value: "\u200b", inline: true },
							{ name: "Moderador", value: interaction.user.tag, inline: true },
						],
					},
				],
			};
		}
	} catch (error) {
		console.error("Error al restringir al miembro:", error);
		await replyError(interaction, "Hubo un error al intentar restringir al miembro.");
	}
}
