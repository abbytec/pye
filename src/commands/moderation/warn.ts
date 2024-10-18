import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	PermissionFlagsBits,
	ActionRowBuilder,
	ButtonBuilder,
	TextChannel,
} from "discord.js";
import { getChannel, getRoleFromEnv, getRoles, USERS } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { replyWarningToMessage } from "../../utils/finalwares/sendFinalMessages.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ModLogs } from "../../Models/ModLogs.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("warn")
		.setDescription("Dale una advertencia a un usuario en el servidor.")
		.addUserOption((option) => option.setName("usuario").setDescription("selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("motivo").setDescription("escribe el motivo del warn").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles(getRoles("staff", "perms")), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const user = interaction.options.getUser("usuario", true);
			const member = await interaction.guild?.members.fetch(user.id);

			if (!member) return replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("perms")) || member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.maby)
				return replyError(interaction, "No puedes darle warn a un miembro del staff.");

			if (user.bot) return replyError(interaction, "No puedes darle warn a un bot.");

			if (user.id === interaction.user.id) return replyError(interaction, "No puedes darte warn a ti mismo.");

			const reason = interaction.options.getString("motivo", true) ?? "No hubo razón.";

			await ModLogs.create({
				id: user.id,
				moderator: interaction.user.tag,
				reason: reason,
				date: Date.now(),
				type: "Warn",
			});

			let data = (await ModLogs.find({ id: user.id }).exec()) ?? [];

			member
				?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
							.setDescription(
								"Has recibido una advertencia en el servidor de **PyE**.\nRecuerda leer <#845314420494434355> para evitar que vuelva a pasar y conocer las sanciones."
							)
							.addFields([
								{ name: "Casos", value: `#${data.length}`, inline: true },
								{ name: "Razón", value: reason, inline: true },
							])
							.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
							.setTimestamp(),
					],
				})
				.catch(() => {
					interaction.editReply("El usuario tiene MD cerrado.");
					interaction.guild?.channels
						.create({
							name: `warn-${member.user.username}`,
							permissionOverwrites: [
								{
									id: interaction.guild.id,
									deny: [PermissionFlagsBits.ViewChannel],
								},
								{
									id: getRoleFromEnv("perms"),
									allow: [PermissionFlagsBits.ViewChannel],
								},
								{
									id: getRoleFromEnv("staff"),
									allow: [PermissionFlagsBits.ViewChannel],
								},
								{
									id: member.id,
									allow: [PermissionFlagsBits.ViewChannel],
									deny: [PermissionFlagsBits.SendMessages],
								},
								{
									id: interaction.client.user.id,
									allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
								},
							],
						})
						.then((canal) => {
							canal.send({
								content: `<@${member.id}> has recibido una advertencia pero tenias MD cerrado.\n<@&994980515335643267>`,
								embeds: [
									new EmbedBuilder()
										.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
										.setDescription(
											"Has recibido una advertencia.\nRecuerda leer <#845314420494434355> para evitar que vuelva a pasar y conocer las sanciones."
										)
										.addFields([
											{ name: "Casos", value: `#${data.length}`, inline: true },
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
			let canal = (await getChannel(interaction, "bansanciones", true)) as TextChannel;

			if (!canal) return;
			canal.send({
				embeds: [
					new EmbedBuilder()
						.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
						.setDescription(`**${member.user.tag}** ha recibido una advertencia .`)
						.addFields([
							{ name: "Razón", value: reason, inline: true },
							{ name: "\u200b", value: "\u200b", inline: true },
							{ name: "Moderador", value: interaction.user.tag, inline: true },
							{ name: "Casos", value: `#${data.length}`, inline: true },
						])
						.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
						.setTimestamp(),
				],
			});
			return { reactWarningMessage: `**${user.username}** ha recibido una advertencia.` };
		},
		[replyWarningToMessage]
	),
};
