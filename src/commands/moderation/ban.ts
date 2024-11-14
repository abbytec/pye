// src/commands/Staff/ban.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, USERS } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ModLogs } from "../../Models/ModLogs.ts";
import { logMessages } from "../../utils/finalwares/logMessages.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("ban")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDescription("Banea a un usuario del servidor.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario a banear").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo del ban").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: ChatInputCommandInteraction) => {
			const user = interaction.options.getUser("usuario", true);
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
									"Has sido baneado del servidor de **PyE**. \nPuedes intentar apelar a tu desbaneo en este servidor: https://discord.gg/F8QxEMtJ3B"
								)
								.addFields([{ name: "Razón", value: reason }])
								.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
								.setTimestamp(),
						],
					})
					// Baneando al usuario
					.then(async () => await interaction.guild?.members.ban(user.id, { reason }))
					.catch(() => null);

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
			} catch (error) {
				console.error(`Error al banear al usuario: ${error}`);
				return await replyError(interaction, "No se pudo banear al usuario.");
			}
		},
		[logMessages]
	),
};
