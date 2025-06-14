// src/commands/Staff/unban.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { ModLogs } from "../../Models/ModLogs.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("unban")
		.setDescription("Desbanea a un usuario del servidor.")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.addStringOption((option) => option.setName("id").setDescription("ID del usuario a desbanear").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo del desban").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const userId = interaction.options.getString("id", true);
			const reason = interaction.options.getString("razon", true);

			// Validar el ID del usuario
			const user = await interaction.client.users.fetch(userId).catch(() => null);
			if (!user) return await replyError(interaction, "No se pudo encontrar al usuario con esa ID.");

			// Verificar si el usuario está baneado
			const bannedUsers = await interaction.guild?.bans.fetch().catch(() => undefined);
			let isBanned = bannedUsers?.has(userId);

			if (!isBanned) await replyError(interaction, "Este usuario no está baneado.");
			else
				await interaction.guild?.members.unban(userId, reason).catch(async (error) => {
					console.error(`Error al desbanear al usuario: ${error}`);
					await replyError(interaction, "No se pudo desbanear al usuario. Quizas no estaba baneado.");
				});

			// Buscar el ban más reciente que no esté oculto
			const latestTimeout = await ModLogs.findOneAndUpdate(
				{ id: user.id, type: "Ban", hiddenCase: { $ne: true } }, // Filtro
				{
					$set: { hiddenCase: true, reasonUnpenalized: reason },
					$setOnInsert: {
						moderator: interaction.user.tag,
						date: new Date(),
					},
				}, // Actualización
				{ sort: { date: -1 }, upsert: true, new: true } // Opciones: ordena por fecha descendente y devuelve el documento actualizado
			);

			if (!latestTimeout) {
				return await replyWarning(
					interaction,
					"Este usuario no tiene bans registrados en la base de datos.\nSi ha sido baneado manualmete, a partir de ahora está desbaneado!",
					undefined,
					undefined,
					undefined,
					undefined,
					false
				);
			}

			// Enviar mensaje directo al usuario
			await user
				.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({
								name: interaction.guild?.name ?? "Servidor",
								iconURL: interaction.guild?.iconURL() ?? undefined,
							})
							.setDescription("Has sido desbaneado del servidor de **PyE**.")
							.addFields([{ name: "Razón", value: reason }])
							.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
							.setTimestamp(),
					],
				})
				.catch(() => null);

			// Responder al comando
			await replyOk(interaction, `**${user.tag}** ha sido desbaneado del servidor.`);
			return {
				logMessages: [
					{
						channel: getChannelFromEnv("bansanciones"),
						user: user,
						description: `**${user.tag}** ha sido desbaneado del servidor.`,
						fields: [
							{ name: "Razón", value: reason },
							{ name: "Moderador", value: interaction.user.tag },
							{ name: "ID", value: `${user.id}` },
						],
					},
				],
			};
		},
		[logMessages]
	),
} as Command;
