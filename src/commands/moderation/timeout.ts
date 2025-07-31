// src/commands/moderation/timeout.ts
import { SlashCommandBuilder, EmbedBuilder, User, GuildMember } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, USERS } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { ModLogs } from "../../Models/ModLogs.js";
import ms from "ms";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { PostHandleable } from "../../types/middleware.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("timeout")
		.setDescription("Aplica un timeout a un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true))
		.addStringOption((option) => option.setName("duracion").setDescription("Duración del timeout (ej: 1h, 30m)").setRequired(true))
		.addStringOption((option) => option.setName("razon").setDescription("Escribe el motivo del timeout").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "moderadorChats"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true).catch(() => null);
			if (!user) return;
			const durationString = interaction.options.getString("duracion", true);
			const reason = interaction.options.getString("razon") ?? "No hubo razón.";

			const member = await interaction.guild?.members.fetch(user.id).catch(() => null);

			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			if (member.roles.cache.has(getRoleFromEnv("staff")) || user.id === USERS.ldarki || user.id === USERS.abby || user.id === USERS.maby)
				return await replyError(interaction, "No puedes darle timeout a un miembro del staff.");

			if (user.id === interaction.user.id) return await replyError(interaction, "No puedes darte timeout a ti mismo.");

			// Parsear la duración
			const duration = ms(durationString);
			if (!duration || duration < 1000 || duration > 28 * 24 * 60 * 60 * 1000)
				return await replyError(interaction, "La duración del timeout no es válida. Debe ser entre 1s y 28d.");

			// Aplicar el timeout
			return await applyTimeout(duration, reason, member, interaction.guild?.iconURL({ extension: "gif" }) ?? null, interaction.user)
				.then(async (result) => {
					if ("logMessages" in result) {
						await replyWarning(
							interaction,
							`**${user.username}** ha recibido un timeout durante \`${ms(duration)}\`.`,
							undefined,
							undefined,
							undefined,
							undefined,
							false
						);
						return result;
					} else {
						return await replyError(interaction, "No se pudo aplicar el timeout al usuario, por favor revisa los logs.");
					}
				})
				.catch(async (error) => {
					console.error("No se pudo aplicar el timeout al usuario." + error);
					return await replyError(interaction, "No se pudo aplicar el timeout al usuario.");
				});
		},
		[logMessages]
	),
} as Command;

export async function applyTimeout(
	duration: number,
	reason: string,
	member: GuildMember,
	interactionGuildIconURL: string | null,
	moderator?: User
): Promise<PostHandleable> {
	return await member.timeout(duration, reason).then(async () => {
		// Registrar en ModLogs
		await ModLogs.create({
			id: member.id,
			moderator: moderator?.tag ?? "BotPyE",
			reason: reason,
			date: new Date(),
			type: "Timeout",
			duration: duration,
		});

		// Obtener todos los casos actuales del usuario
		const data = await ModLogs.countDocuments({ id: member.id });

		// Enviar mensaje directo al usuario
		await member
			.send({
				embeds: [
					new EmbedBuilder()
						.setAuthor({
							name: member.user.tag,
							iconURL: member.user.displayAvatarURL(),
						})
						.setDescription(
							`Has sido aislado en el servidor de **PyE**.\nPodrás interactuar en los canales una vez tu sanción haya terminado. Recuerda leer <#${getChannelFromEnv(
								"reglas"
							)}> para evitar que vuelva a pasar y conocer las sanciones. \nTambién puedes intentar apelar a tu des-aislamiento desde este otro servidor:\nhttps://discord.gg/CsjZVuWK84`
						)
						.addFields([
							{ name: "Tiempo", value: `\`${ms(duration, { long: true })}\``, inline: true },
							{ name: "Casos", value: `#${data}`, inline: true },
							{ name: "Razón", value: reason, inline: true },
						])
						.setThumbnail(interactionGuildIconURL)
						.setTimestamp(),
				],
			})
			.catch(() => console.error("No se pudo enviar el mensaje directo al usuario para avisarle de su timeout: ", member.user.username)); // Ignorar errores si el usuario no acepta DMs
		return {
			logMessages: [
				{
					channel: getChannelFromEnv("bansanciones"),
					user: member.user,
					description: `**${member.user.tag}** ha sido aislado del servidor.`,
					fields: [
						{ name: "Tiempo", value: `\`${ms(duration, { long: true })}\``, inline: true },
						{ name: "Razón", value: reason, inline: true },
						{ name: "ID", value: `${member.id}`, inline: true },
						{ name: "Moderador", value: moderator?.username ?? "BotPyE", inline: true },
						{ name: "Casos", value: `#${data}`, inline: true },
					],
				},
			],
		} as PostHandleable;
	});
}
