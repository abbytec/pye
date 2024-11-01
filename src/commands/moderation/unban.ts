// src/commands/Staff/unban.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getChannelFromEnv } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ModLogs } from "../../Models/ModLogs.ts";
import { logMessages } from "../../utils/finalwares/logMessages.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("unban")
		.setDescription("Desbanea a un usuario del servidor.")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.addStringOption((option) => option.setName("id").setDescription("ID del usuario a desbanear").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo del desban").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("perms"), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const userId = interaction.options.getString("id", true);
			const reason = interaction.options.getString("razon") ?? "No se proporcionó una razón.";

			// Validar el ID del usuario
			const user = await interaction.client.users.fetch(userId).catch(() => null);
			if (!user) return await replyError(interaction, "No se pudo encontrar al usuario con esa ID.");

			// Verificar si el usuario está baneado
			const bannedUsers = await interaction.guild?.bans.fetch();
			let isBanned = bannedUsers?.has(userId);

			if (!isBanned) await replyError(interaction, "Este usuario no está baneado.");
			else
				await interaction.guild?.members.unban(userId, reason).catch(async (error) => {
					console.error(`Error al desbanear al usuario: ${error}`);
					await replyError(interaction, "No se pudo desbanear al usuario.");
				});

			// Registrar en ModLogs
			// Buscar el ban más reciente que no esté oculto
			const latestTimeout = await ModLogs.findOne({ id: user.id, type: "Ban", hiddenCase: { $ne: true } }).sort({ date: -1 });

			if (!latestTimeout) return isBanned ? ({} as PostHandleable) : await replyError(interaction, "Este usuario no tiene bans activos.");

			// Marcar el ban como oculto
			latestTimeout.hiddenCase = true;
			await latestTimeout.save();

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
};
