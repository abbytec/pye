import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, USERS } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { ModLogs } from "../../Models/ModLogs.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("ban")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDescription("Banea a un usuario del servidor.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario a banear").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo del ban").setRequired(true))
		.addStringOption((option) =>
			option
				.setName("borradotiempo")
				.setDescription("¿Cuánto tiempo de mensajes se borrarán? (opcional)")
				.setRequired(false)
				.addChoices({ name: "1 hora", value: "3600" }, { name: "3 horas", value: "10800" }, { name: "1 día", value: "86400" })
		),

	// El middleware y la ejecución del comando:
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true).catch(() => null);
			if (!user) return;
			const reason = interaction.options.getString("razon") ?? "No se proporcionó una razón.";

			// OBTENEMOS LA OPCIÓN DE TIEMPO DE BORRADO
			const deleteTimeOption = interaction.options.getString("borradotiempo");
			const deleteTimeSeconds = deleteTimeOption ? parseInt(deleteTimeOption, 10) : undefined;

			// Intentamos obtener el miembro en el servidor
			const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

			if (!member) {
				// El usuario no es miembro activo del servidor
				// Procedemos a verificar si está baneado
				const isBanned = (await interaction.guild?.bans.fetch().catch(() => undefined))?.has(user.id);
				if (isBanned) return await replyError(interaction, "Este usuario ya está baneado.");
				else return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");
			}

			// Comprobamos si el usuario es Staff o si es el mismo que intenta banear
			if (member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.ldarki)
				return await replyError(interaction, "No puedes banear a un miembro del staff.");

			if (user.id === interaction.user.id) return await replyError(interaction, "No puedes banearte a ti mismo.");

			// Verificar si el usuario ya está baneado
			const bannedUsers = await interaction.guild?.bans.fetch().catch(() => undefined);
			if (bannedUsers?.has(user.id)) return await replyError(interaction, "Este usuario ya está baneado.");

			try {
				// Enviar mensaje directo al usuario informando del ban
				await user
					.send({
						embeds: [
							new EmbedBuilder()
								.setAuthor({
									name: interaction.guild?.name ?? "Servidor",
									iconURL: interaction.guild?.iconURL() ?? undefined,
								})
								.setDescription(
									"Has sido baneado del servidor de **PyE**. \nPuedes intentar apelar a tu desbaneo en este servidor:\nhttps://discord.gg/CsjZVuWK84"
								)
								.addFields([{ name: "Razón", value: reason }])
								.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null)
								.setTimestamp(),
						],
					})
					.catch(() => null);

				await interaction.guild?.members.ban(user.id, {
					reason,
					deleteMessageSeconds: deleteTimeSeconds,
				});

				// Registrar en ModLogs
				await ModLogs.create({
					id: user.id,
					moderator: interaction.user.tag,
					reason: reason,
					date: Date.now(),
					type: "Ban",
				});

				await replyOk(interaction, `**${user.tag}** hasta la vista papu. Te fuiste baneado.`);

				return {
					logMessages: [
						{
							channel: getChannelFromEnv("bansanciones"),
							user: user,
							description: `**${user.tag}** ha sido baneado del servidor.`,
							fields: [
								{ name: "Razón", value: reason },
								{ name: "Moderador", value: interaction.user.tag },
								{ name: "ID", value: `${user.id}` },
							],
						},
					],
				};
			} catch (error: any) {
				console.error(`Error al banear al usuario: ${error}`);
				ExtendedClient.logError("Error al banear al usuario: " + error.message, error.stack, interaction.user.id);
				return await replyError(interaction, "Ocurrió un error al intentar banear al usuario.");
			}
		},
		[logMessages]
	),
} as Command;
