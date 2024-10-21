// src/commands/Staff/timeout.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, getRoles, USERS } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ModLogs } from "../../Models/ModLogs.ts";
import ms from "ms";
import { logMessages, replyWarningToMessage } from "../../utils/finalwares/sendFinalMessages.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("timeout")
		.setDescription("Aplica un timeout a un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("duracion").setDescription("Duración del timeout (ej: 1h, 30m)").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo del timeout").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "perms"), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const user = interaction.options.getUser("usuario", true);
			const durationString = interaction.options.getString("duracion", true);
			const reason = interaction.options.getString("razon") ?? "No hubo razón.";

			const member = await interaction.guild?.members.fetch(user.id);

			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("perms")) || member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.maby) {
				return await replyError(interaction, "No puedes darle timeout a un miembro del staff.");
			}

			if (user.id === interaction.user.id) {
				return await replyError(interaction, "No puedes darte timeout a ti mismo.");
			}

			// Parsear la duración
			const duration = ms(durationString);
			if (!duration || duration < 1000 || duration > 28 * 24 * 60 * 60 * 1000) {
				return await replyError(interaction, "La duración del timeout no es válida. Debe ser entre 1s y 28d.");
			}

			// Aplicar el timeout
			try {
				await member.timeout(duration, reason);

				// Registrar en ModLogs
				await ModLogs.create({
					id: user.id,
					moderator: interaction.user.tag,
					reason: reason,
					date: Date.now(),
					type: "Timeout",
				});

				const data = await ModLogs.find({ id: user.id }).exec();

				// Enviar mensaje directo al usuario
				await member
					.send({
						embeds: [
							new EmbedBuilder()
								.setAuthor({
									name: member.user.tag,
									iconURL: member.user.displayAvatarURL(),
								})
								.setDescription(
									"Has sido aislado en el servidor de **PyE**.\nPodrás interactuar en los canales una vez tu sanción haya terminado. Recuerda leer <#845314420494434355> para evitar que vuelva a pasar y conocer las sanciones. \nTambien puedes intentar apelar a tu des-aislamiento desde este otro servidor: https://discord.gg/F8QxEMtJ3B"
								)
								.addFields([
									{ name: "Tiempo", value: `\`${ms(duration, { long: true })}\``, inline: true },
									{ name: "Casos", value: `#${data.length}`, inline: true },
									{ name: "Razón", value: reason, inline: true },
								])
								.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
								.setTimestamp(),
						],
					})
					.catch(() => null);

				// Responder al comando
				return {
					logMessages: [
						{
							channel: getChannelFromEnv("bansanciones"),
							user: member.user,
							description: `**${member.user.tag}** ha sido aislado del servidor.`,
							fields: [
								{ name: "Tiempo", value: `\`${ms(duration, { long: true })}\``, inline: true },
								{ name: "Razón", value: reason, inline: true },
								{ name: "ID", value: `${member.id}`, inline: true },
								{ name: "Moderador", value: interaction.user.tag, inline: true },
								{ name: "Casos", value: `#${data.length}`, inline: true },
							],
						},
					],
					reactWarningMessage: `**${member.user.tag}** ha sido aislado del servidor por \`${ms(duration, { long: true })}\`.`,
				};
			} catch {
				return await replyError(interaction, "No se pudo aplicar el timeout al usuario.");
			}
		},
		[logMessages, replyWarningToMessage]
	),
};
