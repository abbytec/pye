import { EmbedBuilder, Guild, GuildAuditLogsEntry, TextChannel, User } from "discord.js";
import { HelperPoint } from "../../Models/HelperPoint.js";
import { Home } from "../../Models/Home.js";
import { Pets } from "../../Models/Pets.js";
import { Users } from "../../Models/User.js";
import redis from "../../redis.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { ModLogs } from "../../Models/ModLogs.js";

export async function handleBanAdd(entry: GuildAuditLogsEntry, guild: Guild) {
	const { target, executor, createdTimestamp } = entry;
	if (!target || entry.targetType !== "User" || !executor) return;
	let targetUser = target as User;
	const memberId = targetUser.id;
	const channel = guild.channels.resolve(getChannelFromEnv("bansanciones")) as TextChannel | null;

	if (!executor.bot) {
		await channel
			?.send({
				content: `El miembro **${targetUser.username} (${memberId})** fue baneado __manualmente__ por **${executor.tag}**. Razon: ${
					entry.reason ?? "No se proporciono una razon."
				}`,
			})
			.catch((error) => {
				console.error(`Error al enviar el mensaje: ${error}`);
			});
		await ModLogs.create({
			id: memberId,
			moderator: executor.tag,
			reason: entry.reason ?? "No se proporciono una razon.",
			date: Date.now(),
			type: "Ban",
		}).catch((error) => {
			console.error(`Error al crear el log: ${error}`);
		});
	}

	const [user, helperPoint, home, pet] = await Promise.all([
		Users.findOneAndDelete({ id: memberId }).lean().exec(),
		HelperPoint.findOneAndDelete({ _id: memberId }).lean().exec(),
		Home.findOneAndDelete({ id: memberId }).lean().exec(),
		Pets.findOneAndDelete({ id: memberId }).lean().exec(),
	]);

	await Promise.all([
		redis.sendCommand(["ZREM", "top:all", memberId]),
		redis.sendCommand(["ZREM", "top:cash", memberId]),
		redis.sendCommand(["ZREM", "top:rob", memberId]),
		redis.sendCommand(["ZREM", "top:rep", memberId]),
		redis.sendCommand(["ZREM", "top:bump", memberId]),
	]);

	const embed = new EmbedBuilder()
		.setTitle("Datos del usuario Baneado")
		.setColor(COLORS.errRed)
		.setThumbnail(targetUser.displayAvatarURL() ?? "")
		.addFields(
			{ name: "Usuario", value: `${targetUser.username} (${memberId})`, inline: true },
			{ name: "Baneado por", value: `${executor.username} (${executor.id})`, inline: true },
			{ name: "Fecha de Baneo", value: `<t:${Math.floor(createdTimestamp / 1000)}:F>`, inline: false },
			{ name: "Datos del Usuario", value: JSON.stringify(user) ?? "No se encontraron datos.", inline: false },
			{ name: "Helper Points", value: JSON.stringify(helperPoint) ?? "No se encontraron puntos.", inline: false },
			{ name: "Casa", value: JSON.stringify(home) ?? "No se encontró información.", inline: false },
			{ name: "Mascotas", value: JSON.stringify(pet) ?? "No se encontraron mascotas.", inline: false }
		)
		.setTimestamp();

	channel?.send({ embeds: [embed] });

	console.log(`Datos de ${targetUser.username} eliminados y removidos de Redis.`);
}
