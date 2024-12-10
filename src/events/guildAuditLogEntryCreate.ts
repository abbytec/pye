// src/events/guildAuditLogEntryCreate.ts
import { AuditLogEvent, EmbedBuilder, Events, Guild, GuildAuditLogsEntry, TextChannel, User } from "discord.js";
import { HelperPoint } from "../Models/HelperPoint.js";
import { Home } from "../Models/Home.js";
import { Pets } from "../Models/Pets.js";
import { Users } from "../Models/User.js";
import redis from "../redis.js";
import { COLORS, getChannelFromEnv } from "../utils/constants.js";
import { Evento } from "../types/event.js";
import { ExtendedClient } from "../client.js";

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

				const channel = guild.channels.resolve(getChannelFromEnv("bansanciones")) as TextChannel | null;

				// Verificar si el baneo fue realizado por un bot
				if (!executor.bot) {
					await channel?.send({
						content: `El miembro **${targetUser.username} (${memberId})** fue baneado manualmente por **${executor.tag}**.\nPor lo que sus datos permanecerán en la db.`,
					});
					return;
				}

				// Buscar y eliminar documentos en paralelo
				const [user, helperPoint, home, pet] = await Promise.all([
					Users.findOneAndDelete({ id: memberId }).lean().exec(),
					HelperPoint.findOneAndDelete({ _id: memberId }).lean().exec(),
					Home.findOneAndDelete({ id: memberId }).lean().exec(),
					Pets.findOneAndDelete({ id: memberId }).lean().exec(),
				]);

				// Borrar los rankings
				await Promise.all([
					redis.sendCommand(["ZREM", "top:all", memberId]),
					redis.sendCommand(["ZREM", "top:cash", memberId]),
					redis.sendCommand(["ZREM", "top:rob", memberId]),
					redis.sendCommand(["ZREM", "top:rep", memberId]),
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
			} else if (entry.action === AuditLogEvent.MemberBanRemove) {
				if (!target || entry.targetType !== "User" || !executor) return;
				let targetUser = target as User;
				const memberId = targetUser.id;

				const channel = guild.channels.resolve(getChannelFromEnv("bansanciones")) as TextChannel | null;

				// Verificar si el baneo fue realizado por un bot
				if (!executor.bot) {
					await channel?.send({
						content: `El miembro **${targetUser.username} (${memberId})** fue desbaneado manualmente por **${executor.tag}**.`,
					});
					return;
				}
			}
		} catch (error: any) {
			console.error(`Error en el handler de GuildAuditLogEntryCreate:`, error);
			ExtendedClient.logError("Error en el handler de GuildAuditLogEntryCreate: " + error.message, error.stack, process.env.CLIENT_ID);
		}
	},
} as Evento;
