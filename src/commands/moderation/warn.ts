import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, USERS } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { ModLogs } from "../../Models/ModLogs.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("warn")
		.setDescription("Dale una advertencia a un usuario en el servidor.")
		.addUserOption((option) => option.setName("usuario").setDescription("selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("motivo").setDescription("escribe el motivo del warn").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "moderadorChats", "moderadorVoz"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true).catch(() => null);
			if (!user) return;
			const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.ldarki || user.id === USERS.abby)
				return await replyError(interaction, "No puedes darle warn a un miembro del staff.");

			if (user.bot) return await replyError(interaction, "No puedes darle warn a un bot.");

			if (user.id === interaction.user.id) return await replyError(interaction, "No puedes darte warn a ti mismo.");

			const reason = interaction.options.getString("motivo", true) ?? "No hubo razón.";

			await ModLogs.create({
				id: user.id,
				moderator: interaction.user.tag,
				reason: reason,
				date: Date.now(),
				type: "Warn",
			});

			const data = (await ModLogs.countDocuments({ id: user.id })) ?? [];
			await replyWarning(
				interaction,
				`Se envió una advertencia a **${user.username}**.`,
				undefined,
				undefined,
				undefined,
				undefined,
				false
			);

			member
				?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
							.setDescription(
								`Has recibido una advertencia en el servidor de **PyE**.\nRecuerda leer <#${getChannelFromEnv(
									"reglas"
								)}> para evitar que vuelva a pasar y conocer las sanciones.`
							)
							.addFields([
								{ name: "Casos", value: `#${data}`, inline: true },
								{ name: "Razón", value: reason, inline: true },
							])
							.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
							.setTimestamp(),
					],
				})
				.catch(() => {
					interaction
						.editReply(`El usuario **${user.username}** tiene MD cerrado, creando un canal para la advertencia.`)
						.catch(() => null);
					interaction.guild?.channels
						.create({
							name: `warn-${member.user.username}`,
							permissionOverwrites: [
								{
									id: interaction.guild.id,
									deny: [PermissionFlagsBits.ViewChannel],
								},
								{
									id: getRoleFromEnv("staff"),
									allow: [PermissionFlagsBits.ViewChannel],
								},
								{
									id: getRoleFromEnv("moderadorChats"),
									allow: [PermissionFlagsBits.ViewChannel],
									deny: [PermissionFlagsBits.SendMessages],
								},
								{
									id: member.id,
									allow: [PermissionFlagsBits.ViewChannel],
									deny: [PermissionFlagsBits.SendMessages],
								},
								{
									id: interaction.client.user?.id ?? process.env.CLIENT_ID ?? "",
									allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
								},
							],
						})
						.then((canal) => {
							canal.send({
								content: `<@${member.id}> has recibido una advertencia pero tenias MD cerrado.`,
								embeds: [
									new EmbedBuilder()
										.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
										.setDescription(
											`Has recibido una advertencia.\nRecuerda leer <#${getChannelFromEnv(
												"reglas"
											)}> para evitar que vuelva a pasar y conocer las sanciones.`
										)
										.addFields([
											{ name: "Casos", value: `#${data}`, inline: true },
											{ name: "Razón", value: reason, inline: true },
										])
										.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
										.setTimestamp(),
								],
								components: [
									new ActionRowBuilder<ButtonBuilder>().addComponents(
										new ButtonBuilder().setCustomId("close_warn").setLabel("Cerrar").setStyle(4)
									),
								],
							});
						});
				});

			return {
				logMessages: [
					{
						channel: getChannelFromEnv("bansanciones"),
						user: user,
						description: `**${member.user.tag}** ha recibido una advertencia .`,
						fields: [
							{ name: "Razón", value: reason, inline: true },
							{ name: "\u200b", value: "\u200b", inline: true },
							{ name: "Moderador", value: interaction.user.tag, inline: true },
							{ name: "Casos", value: `#${data}`, inline: true },
						],
					},
				],
			};
		},
		[logMessages]
	),
} as Command;
