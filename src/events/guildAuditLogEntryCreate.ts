// src/events/guildAuditLogEntryCreate.ts
import { AuditLogEvent, Channel, ChannelType, Events, Guild, GuildAuditLogsEntry, GuildChannel } from "discord.js";
import { Evento } from "../types/event.js";
import { ExtendedClient } from "../client.js";
import { handleBanAdd } from "./guildAuditLogEntryCreate/handleBanAdd.js";
import { handleBanRemove } from "./guildAuditLogEntryCreate/handleBanRemove.js";
import { ANSI_COLOR } from "../utils/constants.js";
import {
	logEventCreated,
	logEventDeleted,
	logEventUpdated,
	logSeriesInstanceCreate,
	logSeriesInstanceReset,
	logSeriesInstanceUpdate,
} from "./guildAuditLogEntryCreate/handleEventChange.js";

export default {
	name: Events.GuildAuditLogEntryCreate,
	once: false,
	async execute(entry: GuildAuditLogsEntry, guild: Guild) {
		try {
			switch (entry.action as number) {
				// --- CHANNEL ---
				case AuditLogEvent.ChannelCreate:
					if (entry.target && "name" in entry.target && "type" in entry.target && entry.target.type !== ChannelType.GuildVoice)
						ExtendedClient.auditLog("Canal creado : " + entry.target.name, "success", entry.executor?.username ?? undefined);
					break;
				case AuditLogEvent.ChannelUpdate:
					ExtendedClient.auditLog(
						"Canal Actualizado <#" + entry.targetId + ">\n Cambios:\n" + diff(entry.changes),
						"info",
						entry.executor?.username ?? undefined
					);
					break;
				case AuditLogEvent.ChannelDelete:
					if (entry.target && "name" in entry.target && "type" in entry.target && entry.target.type !== ChannelType.GuildVoice)
						ExtendedClient.auditLog("Canal eliminado: " + entry.target.name, "error", entry.executor?.username ?? undefined);
					break;
				case AuditLogEvent.ChannelOverwriteCreate:
					if (entry.executorId !== process.env.CLIENT_ID) {
						console.log("Permisos cambiados en el canal <#" + entry.targetId + ">\n" + diffConsole(entry.changes));
					}
					break;

				// --- MEMBER ---
				case AuditLogEvent.MemberBanAdd:
					await handleBanAdd(entry, guild);
					break;
				case AuditLogEvent.MemberBanRemove:
					await handleBanRemove(entry, guild);
					break;
				case AuditLogEvent.MemberUpdate:
					console.log("Miembro actualizado: <@" + entry.targetId + ">\n" + diffConsole(entry.changes));
					break;
				case AuditLogEvent.MemberRoleUpdate:
					if (entry.executorId !== process.env.CLIENT_ID) {
						console.log(
							"Roles de <@" + entry.targetId + "> actualizados por <@" + entry.executorId + ">:\n" + diffConsole(entry.changes)
						);
					}
					break;
				case AuditLogEvent.MemberMove:
					console.log("Miembro movido de <#" + entry.targetId + ">\n" + diffConsole(entry.changes));
					break;
				case AuditLogEvent.MemberDisconnect:
					console.log("Miembro desconectado de <#" + entry.targetId + ">\n" + diffConsole(entry.changes));
					break;

				// --- ROLE ---
				case AuditLogEvent.RoleUpdate:
					ExtendedClient.auditLog(
						"Rol actualizado: " + entry.changes.find((c) => c.key === "name")?.new + "\n" + diff(entry.changes),
						"info",
						entry.executor?.username ?? undefined
					);
					break;

				// --- INVITE ---
				case AuditLogEvent.InviteCreate:
					console.log("Invitación creada: " + entry.changes.find((c) => c.key === "code")?.new);
					break;

				// --- MESSAGE ---
				case AuditLogEvent.MessageDelete:
					console.log("Mensaje borrado: <#" + entry.targetId + ">\n" + diffConsole(entry.changes));
					break;

				// --- SCHEDULED EVENT ---
				case AuditLogEvent.GuildScheduledEventCreate:
					await logEventCreated(entry, guild);
					break;
				case AuditLogEvent.GuildScheduledEventUpdate:
					await logEventUpdated(entry, guild);
					break;
				case AuditLogEvent.GuildScheduledEventDelete:
					await logEventDeleted(entry, guild);
					break;

				// --- THREAD ---
				case AuditLogEvent.ThreadCreate:
					if (entry.executorId !== process.env.CLIENT_ID) {
						console.log(
							ANSI_COLOR.GREEN + "Hilo creado: <#" + entry.targetId + ">\n" + ANSI_COLOR.RESET + diffConsole(entry.changes)
						);
					}
					break;
				case AuditLogEvent.ThreadUpdate:
					if (entry.executorId !== process.env.CLIENT_ID) {
						console.log(
							ANSI_COLOR.YELLOW + "Hilo actualizado: <#" + entry.targetId + ">\n" + ANSI_COLOR.RESET + diffConsole(entry.changes)
						);
					}
					break;
				case AuditLogEvent.ThreadDelete:
					if (entry.executorId !== process.env.CLIENT_ID) {
						console.log(
							ANSI_COLOR.RED + "Hilo borrado: <#" + entry.targetId + ">\n" + ANSI_COLOR.RESET + diffConsole(entry.changes)
						);
					}
					break;

				// --- VOICE STATUS ---
				case 192:
				case 193:
					console.log("Estado de voz cambiado: " + diffConsole(entry.changes));
					break;

				// --- SCHEDULED EVENT INSTANCE ---
				case 200:
					await logSeriesInstanceCreate(entry, guild);
					break;
				case 201:
					await logSeriesInstanceUpdate(entry, guild);
					break;
				case 202:
					await logSeriesInstanceReset(entry, guild);
					break;

				// --- UNKNOWN ---
				case 211:
					ExtendedClient.auditLog(
						"Server Tag (¿actualizado?):\n" + diff(entry.changes) + ")",
						"info",
						entry.executor?.username ?? undefined
					);
					break;
				default:
					console.log("Evento desconocido:", entry.action, JSON.stringify(entry));
					break;
			}
		} catch (error: any) {
			console.error(`Error en el handler de GuildAuditLogEntryCreate:`, error);
			ExtendedClient.logError("Error en el handler de GuildAuditLogEntryCreate: " + error.message, error.stack, process.env.CLIENT_ID);
		}
	},
} as Evento;
export function fmt(key: string, v: any) {
	if (key === "scheduled_start_time" || key === "scheduled_end_time" || key === "scheduledStartTimestamp") {
		let ms: number;
		if (typeof v === "string") {
			ms = Date.parse(v);
		} else if (typeof v === "number") {
			ms = v;
		} else {
			ms = NaN;
		}
		if (!Number.isNaN(ms)) return `<t:${Math.floor(ms / 1000)}:F>`;
	}
	if (typeof v === "string" || typeof v === "number") return `${v}`;
	else if (typeof v === "object")
		try {
			return JSON.stringify(v);
		} catch (error) {
			console.error("Error formateando el valor clave de auditoria:", v, error);
		}
	else if (typeof v === "boolean") return getColor(v ? "$add" : "$remove") + `${v}` + ANSI_COLOR.RESET;
	return "`null`"; // resto de claves
}
export function diff(changes: GuildAuditLogsEntry["changes"] | undefined): string {
	return (
		changes
			?.filter((c) => c.old !== c.new)
			.map((c) => `• **${c.key}**: ${fmt(c.key, c.old)} → ${fmt(c.key, c.new)}`)
			.join("\n") ?? "Sin detalles"
	);
}

// Selector de color por clave
function getColor(key: string): string {
	switch (key) {
		case "$add":
			return ANSI_COLOR.GREEN;
		case "$remove":
		case "communication_disabled_until":
		case "deaf":
		case "mute":
			return ANSI_COLOR.ORANGE;
		default:
			return ANSI_COLOR.BLUE;
	}
}

function diffConsole(changes: GuildAuditLogsEntry["changes"] | undefined): string {
	if (!changes?.length) return "Sin detalles";
	return changes
		.map((c, i) => {
			const isLast = i === changes.length - 1;
			const bullet = isLast ? "└" : "├";
			const color = getColor(c.key);
			return `${ANSI_COLOR.GRAY}${bullet}${ANSI_COLOR.RESET} ${color}${c.key}${ANSI_COLOR.RESET}: ${fmt(c.key, c.old)} → ${fmt(
				c.key,
				c.new
			)}`;
		})
		.join("\n");
}
