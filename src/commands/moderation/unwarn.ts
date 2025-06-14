// src/commands/Staff/unwarn.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, USERS } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { replyError } from "../../utils/messages/replyError.js";
import { ModLogs } from "../../Models/ModLogs.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("unwarn")
		.setDescription("Remueve una advertencia a un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo para remover la advertencia").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "moderadorChats", "moderadorVoz"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true).catch(() => null);
			if (!user) return;
			const reason = interaction.options.getString("razon", true);
			const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.maby)
				return await replyError(interaction, "No puedes remover advertencias a un miembro del staff.");

			if (user.id === interaction.user.id) return await replyError(interaction, "No puedes remover advertencias a ti mismo.");

			// Buscar la advertencia más reciente que no esté oculta
			const latestWarn = await ModLogs.findOneAndUpdate(
				{ id: user.id, type: "Warn", hiddenCase: { $ne: true } },
				{
					$set: { hiddenCase: true, reasonUnpenalized: reason },
				},
				{ sort: { date: -1 }, new: true }
			);

			if (!latestWarn) {
				return await replyError(interaction, "Este usuario no tiene advertencias activas.");
			}

			// Enviar mensaje al usuario
			member
				.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
							.setDescription("Se te ha removido una advertencia en **PyE**.\n¡Recuerda no romper las reglas!")
							.addFields([{ name: "Razón", value: reason }])
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
							{ name: "Razón", value: reason, inline: true },
							{ name: "Moderador", value: interaction.user.tag, inline: true },
						],
					},
				],
			};
		},
		[logMessages]
	),
} as Command;
