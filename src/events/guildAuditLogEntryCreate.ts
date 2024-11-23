// src/events/guildAuditLogEntryCreate.ts
import { AuditLogEvent, EmbedBuilder, Events, Guild, GuildAuditLogsEntry, TextChannel, User } from "discord.js";
import { HelperPoint } from "../Models/HelperPoint.ts";
import { Home } from "../Models/Home.ts";
import { Pets } from "../Models/Pets.ts";
import { Users } from "../Models/User.ts";
import redis from "../redis.ts";
import { COLORS, getChannelFromEnv } from "../utils/constants.ts";
import { Evento } from "../types/event.ts";

export default {
	name: Events.GuildAuditLogEntryCreate,
	once: false,
	async execute(entry: GuildAuditLogsEntry, guild: Guild) {
		try {
			const { target, executor, createdTimestamp } = entry;
			// Filtrar solo los eventos de baneo
			if (entry.action === AuditLogEvent.MemberBanAdd) {
				// Verificar que el objetivo sea un miembro válido
				if (!target || entry.targetType !== "User" || !executor) return;
				let targetUser = target as User;
				const memberId = targetUser.id;

				// Verificar si el baneo fue realizado por un bot
				if (!executor.bot) {
					console.log(`El miembro ${targetUser.username} fue baneado por ${executor.tag}, que no es un bot.`);
					return;
				}

				// Buscar y eliminar documentos en paralelo
				const [user, helperPoint, home, pet] = await Promise.all([
					Users.findOneAndDelete({ id: memberId }).exec(),
					HelperPoint.findOneAndDelete({ _id: memberId }).exec(),
					Home.findOneAndDelete({ id: memberId }).exec(),
					Pets.findOneAndDelete({ id: memberId }).exec(),
				]);

				// Borrar los rankings
				await Promise.all([
					redis.sendCommand(["ZREM", "top:all", memberId]),
					redis.sendCommand(["ZREM", "top:cash", memberId]),
					redis.sendCommand(["ZREM", "top:rob", memberId]),
					redis.sendCommand(["ZREM", "top:rep", memberId]),
				]);

				const channel = guild.channels.resolve(getChannelFromEnv("bansanciones")) as TextChannel;

				const embed = new EmbedBuilder()
					.setTitle("Datos del usuario Baneado")
					.setColor(COLORS.errRed)
					.setThumbnail(targetUser.displayAvatarURL() ?? "")
					.addFields(
						{ name: "Usuario", value: `${targetUser.username} (${memberId})`, inline: true },
						{ name: "Baneado por", value: `${executor.username} (${executor.id})`, inline: true },
						{ name: "Fecha de Baneo", value: `<t:${Math.floor(createdTimestamp / 1000)}:F>`, inline: false },
						{ name: "Datos del Usuario", value: JSON.stringify(user?.toObject()) ?? "No se encontraron datos.", inline: false },
						{ name: "Helper Points", value: JSON.stringify(helperPoint?.toObject()) ?? "No se encontraron puntos.", inline: false },
						{ name: "Casa", value: JSON.stringify(home?.toObject()) ?? "No se encontró información.", inline: false },
						{ name: "Mascotas", value: JSON.stringify(pet?.toObject()) ?? "No se encontraron mascotas.", inline: false }
					)
					.setTimestamp();

				channel.send({ embeds: [embed] });

				console.log(`Datos de ${targetUser.username} eliminados y removidos de Redis.`);
			}
		} catch (error) {
			console.error(`Error en el handler de GuildAuditLogEntryCreate:`, error);
		}
	},
} as Evento;
