// src/commands/Staff/unwarn.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, USERS } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ModLogs } from "../../Models/ModLogs.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { logMessages } from "../../utils/finalwares/logMessages.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("unwarn")
		.setDescription("Remueve una advertencia a un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo para remover la advertencia").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "perms"), deferInteraction()],
		async (interaction: ChatInputCommandInteraction) => {
			const user = interaction.options.getUser("usuario", true);
			const member = await interaction.guild?.members.fetch(user.id);

			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("perms")) || member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.maby)
				return await replyError(interaction, "No puedes remover advertencias a un miembro del staff.");

			if (user.id === interaction.user.id) return await replyError(interaction, "No puedes remover advertencias a ti mismo.");

			// Buscar la advertencia más reciente que no esté oculta
			const latestWarn = await ModLogs.findOne({ id: user.id, type: "Warn", hiddenCase: { $ne: true } }).sort({ date: -1 });

			if (!latestWarn) return await replyError(interaction, "Este usuario no tiene advertencias activas.");

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

			await replyOk(interaction, `Se ha removido la advertencia de **${member.user.tag}**.`);
			return {
				logMessages: [
					{
						channel: getChannelFromEnv("bansanciones"),
						user: user,
						description: `Se ha removido una advertencia a: **${member.user.tag}**`,
						fields: [
							{ name: "Razón", value: interaction.options.getString("razon") ?? "No hubo razón.", inline: true },
							{ name: "Moderador", value: interaction.user.tag, inline: true },
						],
					},
				],
			};
		},
		[logMessages]
	),
};
