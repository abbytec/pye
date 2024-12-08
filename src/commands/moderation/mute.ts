// src/commands/Moderation/mute.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, GuildMember } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";
import { COLORS, getChannelFromEnv, getRoleFromEnv } from "../../utils/constants.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { ModLogs } from "../../Models/ModLogs.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	data: new SlashCommandBuilder()
		.setName("voice-mute")
		.setDescription("Ver o editar el estado de silencio de un miembro.")
		// Subcomando: view
		.addSubcommand((subcommand) =>
			subcommand
				.setName("view")
				.setDescription("Verificar si un miembro está muteado manualmente o por rol.")
				.addUserOption((option) => option.setName("miembro").setDescription("El miembro a verificar.").setRequired(true))
		)
		// Subcomando: toggle
		.addSubcommand((subcommand) =>
			subcommand
				.setName("toggle")
				.setDescription("Mutea/desmutea a un miembro por rol.")
				.addUserOption((option) => option.setName("miembro").setDescription("El miembro a muteo/desmuteo.").setRequired(true))
				.addStringOption((option) => option.setName("motivo").setDescription("El motivo del muteo/desmuteo.").setRequired(false))
		)
		// Configuración de permisos: solo usuarios con 'Mute Members' pueden usar 'toggle'
		.setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "moderadorVoz"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const subcommand = interaction.options.getSubcommand();
			const memberUser = await interaction.options.getUser("miembro");

			if (!memberUser) {
				return await replyError(interaction, "No se pudo encontrar al miembro especificado.");
			}

			const guildMember = interaction.guild?.members.cache.get(memberUser.id);

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
 * Maneja el subcomando 'view' para verificar el estado de muteo.
 */
async function handleView(interaction: IPrefixChatInputCommand, member: GuildMember): Promise<void> {
	try {
		const mutedRoleId = getRoleFromEnv("silenced");
		const hasMutedRole = mutedRoleId ? member.roles.cache.has(mutedRoleId) : false;
		const mutedRole = interaction.guild?.roles.cache.get(mutedRoleId);
		const isVoiceMuted = member.voice.mute;

		let description = "**Muteado por Rol:**" + (hasMutedRole ? "Sí (" + mutedRole?.name + ")" : "No");
		description += "**En Canal de Voz:**" + (member.voice.channel ? member.voice.channel.name : "No está conectado a ningú canal de voz.");

		if (!hasMutedRole && isVoiceMuted) {
			description += "**Silenciado manualmente:** Sí";
		}

		const embed = new EmbedBuilder()
			.setAuthor({
				name: interaction.client.user?.tag || "Bot",
				iconURL: interaction.client.user?.displayAvatarURL() || "",
			})
			.setTitle(`Estado de Muteo de ${member.user.tag}`)
			.setDescription(description)
			.setTimestamp();
		if (hasMutedRole) embed.setColor(COLORS.warnOrange);
		else if (isVoiceMuted) embed.setColor(COLORS.errRed);
		else embed.setColor(COLORS.okGreen);

		await replyOk(interaction, [embed]);
	} catch (error) {
		console.error("Error al verificar el estado de muteo:", error);
		await replyError(interaction, "Hubo un error al verificar el estado de muteo.");
	}
}

/**
 * Maneja el subcomando 'toggle' para muteo/desmuteo por rol.
 */
async function handleToggle(interaction: IPrefixChatInputCommand, member: GuildMember): Promise<PostHandleable | void> {
	try {
		const mutedRoleId = getRoleFromEnv("silenced");

		if (!mutedRoleId) {
			return await replyError(interaction, "El rol de muteo no está configurado correctamente.");
		}

		const mutedRole = interaction.guild?.roles.cache.get(mutedRoleId);

		if (!mutedRole) {
			return await replyError(interaction, "El rol de muteo no existe en este servidor.");
		}

		const reason = interaction.options.getString("motivo") ?? "Ninguno";

		const hasMutedRole = member.roles.cache.has(mutedRoleId);
		let action: "Muteado" | "Desmuteado";
		let message: string;

		if (hasMutedRole) {
			// Desmutear
			await member.roles.remove(mutedRole, `${reason} - Desmuteado por ${interaction.user.tag}`);
			action = "Desmuteado";
			message = `Se ha ${action.toLowerCase()} a: **${member.user.tag}**.`;

			await ModLogs.findOneAndUpdate(
				{ id: member.id, type: "Voice-mute", hiddenCase: { $ne: true } },
				{ $set: { hiddenCase: true, reasonUnpenalized: reason } },
				{ sort: { date: -1 }, new: true, upsert: true }
			);

			await replyOk(interaction, message, undefined, undefined, undefined, undefined, false);
		} else {
			// Mutear
			await member.roles.add(mutedRole, `${reason} - Muteado por ${interaction.user.tag}`);
			action = "Muteado";
			message = `Se ha ${action.toLowerCase()} a: **${member.user.tag}**.`;

			await ModLogs.create({
				id: member.id,
				moderator: interaction.user.tag,
				reason: reason,
				date: Date.now(),
				type: "Voice-mute",
			});

			await replyWarning(interaction, message, undefined, undefined, undefined, undefined, false);
		}

		// Preparar el log
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
		console.error("Error al muteo al miembro:", error);
		await replyError(interaction, "Hubo un error al intentar muteo al miembro.");
	}
}
