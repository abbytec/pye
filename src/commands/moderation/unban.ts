// src/commands/Staff/unban.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, TextChannel } from "discord.js";
import { getChannel, getRoleFromEnv, getRoles, USERS } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ModLogs } from "../../Models/ModLogs.ts";
import { replyOkToMessage } from "../../utils/finalwares/sendFinalMessages.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("unban")
		.setDescription("Desbanea a un usuario del servidor.")
		.addStringOption((option) => option.setName("id").setDescription("ID del usuario a desbanear").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo del desban").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles(getRoles("staff", "perms")), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const userId = interaction.options.getString("id", true);
			const reason = interaction.options.getString("razon") ?? "No se proporcionó una razón.";

			// Validar el ID del usuario
			const user = await interaction.client.users.fetch(userId).catch(() => null);
			if (!user) {
				return replyError(interaction, "No se pudo encontrar al usuario con esa ID.");
			}

			// Verificar si el usuario está baneado
			const bannedUsers = await interaction.guild?.bans.fetch();
			let isBanned = bannedUsers?.has(userId);
			if (!isBanned) {
				await replyError(interaction, "Este usuario no está baneado.");
			} else {
				// Desbanear al usuario
				await interaction.guild?.members.unban(userId, reason).catch(async (error) => {
					console.error(`Error al desbanear al usuario: ${error}`);
					await replyError(interaction, "No se pudo desbanear al usuario.");
				});
			}

			// Registrar en ModLogs
			// Buscar el ban más reciente que no esté oculto
			const latestTimeout = await ModLogs.findOne({ id: user.id, type: "Ban", hiddenCase: { $ne: true } }).sort({ date: -1 });

			if (!latestTimeout) {
				return isBanned ? {} : replyError(interaction, "Este usuario no tiene bans activos.");
			}

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

			// Enviar mensaje al canal de sanciones
			const canal = (await getChannel(interaction, "bansanciones", true)) as TextChannel;
			if (canal) {
				canal.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({
								name: user.tag,
								iconURL: user.displayAvatarURL(),
							})
							.setDescription(`**${user.tag}** ha sido desbaneado del servidor.`)
							.addFields([
								{ name: "Razón", value: reason },
								{ name: "Moderador", value: interaction.user.tag },
								{ name: "ID", value: `${user.id}` },
							])
							.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
							.setTimestamp(),
					],
				});
			}

			// Responder al comando
			return { reactOkMessage: `**${user.tag}** ha sido desbaneado del servidor.` };
		},
		[replyOkToMessage]
	),
};
