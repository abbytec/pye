import { EmbedBuilder, Guild, GuildAuditLogsEntry, TextChannel, User } from "discord.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { ModLogs } from "../../Models/ModLogs.js";

export async function handleMemberKick(entry: GuildAuditLogsEntry, guild: Guild) {
	const { target, executor, createdTimestamp } = entry;
	if (!target || entry.targetType !== "User" || !executor) return;
	let targetUser = target as User;
	const memberId = targetUser.id;
	const channel = guild.channels.resolve(getChannelFromEnv("bansanciones")) as TextChannel | null;

	if (executor.bot) {
		await channel
			?.send({
				content: `El miembro **${targetUser.username} (${memberId})** fue expulsado por **${executor.displayName}**. Razón: ${
					entry.reason ?? "No se proporcionó una razón."
				}`,
			})
			.catch((error) => {
				console.error(`Error al enviar el mensaje: ${error}`);
			});
	} else {
		const embed = new EmbedBuilder()
			.setTitle("Usuario Expulsado")
			.setColor(COLORS.warnOrange)
			.setThumbnail(targetUser.displayAvatarURL() ?? "")
			.addFields(
				{ name: "Usuario", value: `${targetUser.username} (${memberId})`, inline: true },
				{ name: "Razón", value: entry.reason ?? "No se proporcionó una razón.", inline: false },
				{ name: "Expulsado por", value: `${executor.username} (${executor.id})`, inline: true }
			)
			.setTimestamp();

		channel?.send({ embeds: [embed] }).catch((error) => {
			console.error(`Error al enviar el mensaje: ${error}`);
		});
	}
}
