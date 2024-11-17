// src/events/guildMemberRemove.ts

import { AuditLogEvent, EmbedBuilder, Events, GuildMember, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { HelperPoint } from "../Models/HelperPoint.ts";
import { Home } from "../Models/Home.ts";
import { Pets } from "../Models/Pets.ts";
import { Users } from "../Models/User.ts";
import redis from "../redis.ts";
import { COLORS, getChannelFromEnv } from "../utils/constants.ts";

export default {
	name: Events.GuildMemberRemove,
	once: false,
	async execute(member: GuildMember) {
		try {
			// Esperar unos segundos para asegurarse de que los audit logs se hayan actualizado
			await delay(3000);

			const guild = member.guild;

			// Fetch the audit logs for bans
			const auditLogs = await guild.fetchAuditLogs({
				limit: 1,
				type: AuditLogEvent.MemberBanAdd,
			});

			const banLog = auditLogs.entries.first();

			if (!banLog) {
				console.log(`No se encontró un registro de baneo para ${member.user.tag}.`);
				return;
			}

			// Verificar si el baneo corresponde al miembro que se acaba de remover
			if (banLog.target?.id !== member.id) {
				console.log(`El último baneo no corresponde a ${member.user.tag}.`);
				return;
			}

			// Verificar si el baneo fue realizado por un bot
			const executor = banLog.executor;
			if (!executor) {
				console.log(`No se encontró un ejecutor en el registro de baneo para ${member.user.tag}.`);
				return;
			}

			if (!executor.bot) {
				console.log(`El miembro ${member.user.tag} fue baneado por ${executor.tag}, que no es un bot.`);
				return;
			}

			// Buscar y eliminar documentos en paralelo
			// Buscar y eliminar documentos en paralelo
			const [user, helperPoint, home, pet] = await Promise.all([
				Users.findOneAndDelete({ id: member.id }).exec(),
				HelperPoint.findOneAndDelete({ _id: member.id }).exec(),
				Home.findOneAndDelete({ id: member.id }).exec(),
				Pets.findOneAndDelete({ id: member.id }).exec(),
			]);

			// Borrar los rankings
			await delay(5000).then(() => {
				redis.sendCommand(["ZREM", "top:all", member.id]);
				redis.sendCommand(["ZREM", "top:cash", member.id]);
				redis.sendCommand(["ZREM", "top:rob", member.id]);
			});

			const channel = member.guild.channels.resolve(getChannelFromEnv("bansanciones")) as TextChannel;

			const embed = new EmbedBuilder()
				.setTitle("Datos del usuario Baneado")
				.setColor(COLORS.errRed) // Color rojo para indicar baneo
				.setThumbnail(member.user.displayAvatarURL())
				.addFields(
					{ name: "Usuario", value: `${member.user.tag} (${member.id})`, inline: true },
					{ name: "Baneado por", value: `${executor.tag} (${executor.id})`, inline: true },
					{ name: "Fecha de Baneo", value: `<t:${Math.floor(banLog.createdTimestamp / 1000)}:F>`, inline: false },
					// Información adicional de los documentos eliminados
					{
						name: "Datos del Usuario",
						value: JSON.stringify(user?.toObject()) ?? "No se encontraron datos adicionales del usuario.",
						inline: false,
					},
					{
						name: "Helper Points",
						value: JSON.stringify(helperPoint?.toObject()) ?? "No se encontraron puntos de ayuda.",
						inline: false,
					},
					{
						name: "Casa",
						value: JSON.stringify(home?.toObject()) ?? "No se encontró información de la casa.",
						inline: false,
					},
					{
						name: "Mascotas",
						value: JSON.stringify(pet?.toObject()) ?? "No se encontraron mascotas.",
						inline: false,
					}
				)
				.setTimestamp();

			channel.send({ embeds: [embed] });

			console.log(`Datos de ${member.user.tag} eliminados y removidos de Redis.`);
		} catch (error) {
			console.error(`Error en el handler de GuildMemberRemove para ${member.user.tag}:`, error);
		}
	},
};

/**
 * Función para crear un delay.
 * @param ms - Milisegundos a esperar.
 * @returns Promesa que se resuelve después de ms milisegundos.
 */
function delay(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
