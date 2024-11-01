// src/commands/Staff/untimeout.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, USERS } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ModLogs } from "../../Models/ModLogs.ts";
import { logMessages, replyOkToMessage } from "../../utils/finalwares/sendFinalMessages.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("untimeout")
		.setDescription("Remueve el timeout de un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo para remover el timeout").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "perms"), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const user = interaction.options.getUser("usuario", true);
			const reason = interaction.options.getString("razon") ?? "No hubo razón.";

			const member = await interaction.guild?.members.fetch(user.id);

			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("perms")) || member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.maby)
				return await replyError(interaction, "No puedes remover el timeout a un miembro del staff.");

			if (user.id === interaction.user.id) return await replyError(interaction, "No puedes removerte el timeout a ti mismo.");

			// Verificar si el miembro está en timeout
			if (!member.isCommunicationDisabled()) return await replyError(interaction, "El usuario no está en timeout.");

			// Remover el timeout
			try {
				await member.timeout(null, reason);

				// Registrar en ModLogs
				// Buscar el timeout más reciente que no esté oculto
				const latestTimeout = await ModLogs.findOne({ id: user.id, type: "Timeout", hiddenCase: { $ne: true } }).sort({ date: -1 });

				if (!latestTimeout) return await replyError(interaction, "Este usuario no tiene timeouts activos.");

				// Marcar el timeout como oculto
				latestTimeout.hiddenCase = true;
				await latestTimeout.save();

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
					reactOkMessage: `Se ha removido el timeout de **${member.user.tag}**.`,
				};
			} catch {
				return await replyError(interaction, "No se pudo remover el timeout del usuario.");
			}
		},
		[logMessages, replyOkToMessage]
	),
};
