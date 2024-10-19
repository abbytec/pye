// src/commands/Staff/unwarn.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, TextChannel } from "discord.js";
import { getChannel, getRoleFromEnv, getRoles, USERS } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ModLogs } from "../../Models/ModLogs.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyOkToMessage } from "../../utils/finalwares/sendFinalMessages.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("unwarn")
		.setDescription("Remueve una advertencia a un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo para remover la advertencia").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles(getRoles("staff", "perms")), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const user = interaction.options.getUser("usuario", true);
			const member = await interaction.guild?.members.fetch(user.id);

			if (!member) return replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("perms")) || member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.maby) {
				return replyError(interaction, "No puedes remover advertencias a un miembro del staff.");
			}

			if (user.id === interaction.user.id) {
				return replyError(interaction, "No puedes remover advertencias a ti mismo.");
			}

			// Buscar la advertencia más reciente que no esté oculta
			const latestWarn = await ModLogs.findOne({ id: user.id, type: "Warn", hiddenCase: { $ne: true } }).sort({ date: -1 });

			if (!latestWarn) {
				return replyError(interaction, "Este usuario no tiene advertencias activas.");
			}

			// Marcar la advertencia como oculta
			latestWarn.hiddenCase = true;
			await latestWarn.save();

			// Enviar mensaje al usuario
			member
				.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
							.setDescription("Se te ha removido una advertencia en **PyE**.\n¡Recuerda no romper las reglas!")
							.addFields([{ name: "Razón", value: interaction.options.getString("razon") ?? "No hubo razón." }])
							.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
							.setTimestamp(),
					],
				})
				.catch(() => null);

			// Notificar en el canal de sanciones
			const canal = (await getChannel(interaction, "bansanciones", true)) as TextChannel;
			if (canal) {
				canal.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
							.setDescription(`Se ha removido una advertencia a: **${member.user.tag}**`)
							.addFields([
								{ name: "Razón", value: interaction.options.getString("razon") ?? "No hubo razón.", inline: true },
								{ name: "Moderador", value: interaction.user.tag, inline: true },
							])
							.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
							.setTimestamp(),
					],
				});
			}
			return { reactOkMessage: `Se ha removido una advertencia de **${member.user.tag}**.` };
		},
		[replyOkToMessage]
	),
};
