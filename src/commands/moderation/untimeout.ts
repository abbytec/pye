// src/commands/Staff/untimeout.ts
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
		.setName("untimeout")
		.setDescription("Remueve el timeout de un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo para remover el timeout").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles(getRoles("staff", "perms")), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const user = interaction.options.getUser("usuario", true);
			const reason = interaction.options.getString("razon") ?? "No hubo razón.";

			const member = await interaction.guild?.members.fetch(user.id);

			if (!member) return replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("perms")) || member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.maby) {
				return replyError(interaction, "No puedes remover el timeout a un miembro del staff.");
			}

			if (user.id === interaction.user.id) {
				return replyError(interaction, "No puedes removerte el timeout a ti mismo.");
			}

			// Verificar si el miembro está en timeout
			if (!member.isCommunicationDisabled()) {
				return replyError(interaction, "El usuario no está en timeout.");
			}

			// Remover el timeout
			try {
				await member.timeout(null, reason);

				// Registrar en ModLogs
				// Buscar la advertencia más reciente que no esté oculta
				const latestTimeout = await ModLogs.findOne({ id: user.id, type: "Timeout", hiddenCase: { $ne: true } }).sort({ date: -1 });

				if (!latestTimeout) {
					return replyError(interaction, "Este usuario no tiene advertencias activas.");
				}

				// Marcar la advertencia como oculta
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

				// Enviar mensaje al canal de sanciones
				const canal = (await getChannel(interaction, "bansanciones", true)) as TextChannel;
				if (canal) {
					canal.send({
						embeds: [
							new EmbedBuilder()
								.setAuthor({
									name: member.user.tag,
									iconURL: member.user.displayAvatarURL(),
								})
								.setDescription(`Se ha removido el timeout a: **${member.user.tag}**`)
								.addFields([
									{ name: "Razón", value: reason },
									{ name: "Moderador", value: interaction.user.tag },
								])
								.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
								.setTimestamp(),
						],
					});
				}

				// Responder al comando
				return { reactOkMessage: `Se ha removido el timeout de **${member.user.tag}**.` };
			} catch {
				return replyError(interaction, "No se pudo remover el timeout del usuario.");
			}
		},
		[replyOkToMessage]
	),
};
