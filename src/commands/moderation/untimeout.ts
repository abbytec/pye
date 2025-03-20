// src/commands/Staff/untimeout.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
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

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("untimeout")
		.setDescription("Remueve el timeout de un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo para remover el timeout").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "moderadorChats"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true).catch(() => null);
			if (!user) return;
			const reason = interaction.options.getString("razon", true);

			const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.maby)
				return await replyError(interaction, "No puedes remover el timeout a un miembro del staff.");

			if (user.id === interaction.user.id) return await replyError(interaction, "No puedes removerte el timeout a ti mismo.");

			// Verificar si el miembro está en timeout
			if (!member.isCommunicationDisabled()) await replyError(interaction, "El usuario no está en timeout.");

			// Remover el timeout
			try {
				const latestTimeout = await member
					.timeout(null, reason)
					.then(async () => {
						await ModLogs.findOneAndUpdate(
							{ id: user.id, type: "Timeout", hiddenCase: { $ne: true } }, // Filtro
							{
								$set: { hiddenCase: true, reasonUnpenalized: reason },
								$setOnInsert: {
									moderator: interaction.user.tag,
									date: new Date(),
								},
							}, // Actualización
							{ sort: { date: -1 }, upsert: true, new: true } // Opciones: ordena por fecha descendente y devuelve el documento actualizado
						);
					})
					.catch(() => null);

				// Buscar el timeout más reciente que no esté oculto
				if (!latestTimeout) {
					return await replyError(interaction, "Este usuario no tiene timeouts recientes.");
				}

				// Enviar mensaje directo al usuario
				await member.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({
								name: member.user.tag,
								iconURL: member.user.displayAvatarURL(),
							})
							.setDescription("Se te ha removido el timeout en **PyE**.\n¡Recuerda no romper las reglas!")
							.addFields([{ name: "Razón", value: reason }])
							.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
							.setTimestamp(),
					],
				});

				// Responder al comando
				await replyOk(interaction, `Se ha removido el timeout de **${member.user.tag}**.`);
				return {
					logMessages: [
						{
							channel: getChannelFromEnv("bansanciones"),
							user: user,
							description: `Se ha removido el timeout a: **${member.user.tag}**`,
							fields: [
								{ name: "Razón", value: reason },
								{ name: "Moderador", value: interaction.user.tag },
							],
						},
					],
				};
			} catch {
				return await replyError(interaction, "No se pudo remover el timeout del usuario.");
			}
		},
		[logMessages]
	),
} as Command;
