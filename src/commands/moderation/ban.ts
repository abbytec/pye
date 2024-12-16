// src/commands/Staff/ban.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, USERS } from "../../utils/constants.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { ModLogs } from "../../Models/ModLogs.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("ban")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDescription("Banea a un usuario del servidor.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario a banear").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo del ban").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true).catch(() => null);
			if (!user) return;
			const reason = interaction.options.getString("razon") ?? "No se proporcionó una razón.";

			const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

			if (!member) {
				// El usuario no es miembro activo del servidor
				// Procedemos a verificar si está baneado
				const isBanned = (await interaction.guild?.bans.fetch())?.has(user.id);
				if (isBanned) {
					return await replyError(interaction, "Este usuario ya está baneado.");
				} else {
					return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");
				}
			}

			if (member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.maby)
				return await replyError(interaction, "No puedes banear a un miembro del staff.");

			if (user.id === interaction.user.id) return await replyError(interaction, "No puedes banearte a ti mismo.");

			// Verificar si el usuario ya está baneado
			const bannedUsers = await interaction.guild?.bans.fetch();
			if (bannedUsers?.has(user.id)) return await replyError(interaction, "Este usuario ya está baneado.");

			try {
				// Enviar mensaje directo al usuario
				await user
					.send({
						embeds: [
							new EmbedBuilder()
								.setAuthor({
									name: interaction.guild?.name ?? "Servidor",
									iconURL: interaction.guild?.iconURL() ?? undefined,
								})
								.setDescription(
									"Has sido baneado del servidor de **PyE**. \nPuedes intentar apelar a tu desbaneo en este servidor:\nhttps://discord.gg/F8QxEMtJ3B"
								)
								.addFields([{ name: "Razón", value: reason }])
								.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
								.setTimestamp(),
						],
					})
					.catch(() => null)
					.finally(
						async () =>
							await interaction.guild?.members.ban(user.id, { reason }).catch((error) => {
								console.error(`Error al banear al usuario: ${error}`);
								ExtendedClient.logError("Error al banear al usuario: " + error.message, error.stack, interaction.user.id);
							})
					);

				// Registrar en ModLogs
				await ModLogs.create({
					id: user.id,
					moderator: interaction.user.tag,
					reason: reason,
					date: Date.now(),
					type: "Ban",
				});

				await replyOk(interaction, `**${user.tag}** hasta la vista papu. Te fuiste baneado.`);

				// Responder al comando
				return {
					logMessages: [
						{
							channel: getChannelFromEnv("bansanciones"),
							user: user,
							description: `**${user.tag}** ha sido baneado del servidor.`,
							fields: [
								{ name: "Razón", value: reason },
								{ name: "Moderador", value: interaction.user.tag },
								{ name: "ID", value: `${user.id}` },
							],
						},
					],
				};
			} catch (error: any) {
				console.error(`Error al banear al usuario: ${error}`);
				ExtendedClient.logError("Error al banear al usuario: " + error.message, error.stack, interaction.user.id);
			}
		},
		[logMessages]
	),
} as Command;
