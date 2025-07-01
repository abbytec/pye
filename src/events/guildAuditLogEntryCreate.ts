// src/events/guildAuditLogEntryCreate.ts
import { AuditLogEvent, ChannelType, Events, Guild, GuildAuditLogsEntry, GuildChannel, GuildScheduledEventStatus } from "discord.js";
import { Evento } from "../types/event.js";
import { ExtendedClient } from "../client.js";
import { handleBanAdd } from "./guildAuditLogEntryCreate/handleBanAdd.js";
import { handleBanRemove } from "./guildAuditLogEntryCreate/handleBanRemove.js";
import { ANSI_COLOR, DYNO_UID, SLASHBOT_UID, VOICEMASTER_UID, YAGPDB_XYZ_UID, CIRCLE_UID } from "../utils/constants.js";
import {
	logEventCreated,
	logEventDeleted,
	logEventUpdated,
	logSeriesInstanceCreate,
	logSeriesInstanceReset,
	logSeriesInstanceUpdate,
} from "./guildAuditLogEntryCreate/handleEventChange.js";
import { ticketTypes } from "../utils/constants/ticketOptions.js";
import { logThreadCreate, logThreadDelete, logThreadUpdate } from "./guildAuditLogEntryCreate/handleThreadAction.js";
import { handleMemberKick } from "./guildAuditLogEntryCreate/handleMemberKick.js";
import {
	handleStageInstanceCreate,
	handleStageInstanceDelete,
	handleStageInstanceUpdate,
} from "./guildAuditLogEntryCreate/handleStageChange.js";

export default {
	name: Events.GuildAuditLogEntryCreate,
	once: false,
	async execute(entry: GuildAuditLogsEntry, guild: Guild) {
		try {
			switch (entry.action as number) {
				// --- CHANNEL ---
				case AuditLogEvent.ChannelCreate:
					if (entry.target && "name" in entry.target && "type" in entry.target) {
						const channelName = entry.target.name as string;
						if (entry.executorId === process.env.CLIENT_ID && ticketTypes.some((type) => channelName.includes(type))) break;
						ExtendedClient.auditLog(
							"Canal creado : " + entry.target.name,
							"success",
							entry.executor?.username ?? undefined,
							entry.target.type === ChannelType.GuildVoice ? "voiceLogs" : "logs"
						);
					}
					break;
				case AuditLogEvent.ChannelUpdate:
					if (entry.target && "type" in entry.target)
						ExtendedClient.auditLog(
							"Canal Actualizado <#" + entry.targetId + ">\n Cambios:\n" + diff(entry.changes, entry.targetType),
							"info",
							entry.executor?.username ?? undefined,
							entry.target.type === ChannelType.GuildVoice ? "voiceLogs" : "logs"
						);
					break;
				case AuditLogEvent.ChannelDelete:
					if (entry.target && "name" in entry.target && "type" in entry.target) {
						const channelName = entry.target.name as string;
						if (entry.executorId === process.env.CLIENT_ID && ticketTypes.some((type) => channelName.includes(type))) break;
						ExtendedClient.auditLog(
							"Canal eliminado: " + entry.target.name,
							"error",
							entry.executor?.username ?? undefined,
							entry.target.type === ChannelType.GuildVoice ? "voiceLogs" : "logs"
						);
					}
					break;
				case AuditLogEvent.ChannelOverwriteCreate:
					if (entry.executorId !== process.env.CLIENT_ID) {
						console.log(
							ANSI_COLOR.GREEN +
								"Permisos especificos agregados en el canal <#" +
								entry.targetId +
								">\n" +
								ANSI_COLOR.RESET +
								diffConsole(entry.changes, entry.targetType)
						);
					}
					break;
				case AuditLogEvent.ChannelOverwriteUpdate:
					if (entry.executorId !== process.env.CLIENT_ID) {
						console.log(
							ANSI_COLOR.YELLOW +
								"Permisos especificos modificados en el canal <#" +
								entry.targetId +
								">\n" +
								ANSI_COLOR.RESET +
								diffConsole(entry.changes, entry.targetType)
						);
					}
					break;

				// --- MEMBER ---
				case AuditLogEvent.MemberKick:
					await handleMemberKick(entry, guild);
					break;
				case AuditLogEvent.MemberBanAdd:
					await handleBanAdd(entry, guild);
					break;
				case AuditLogEvent.MemberBanRemove:
					await handleBanRemove(entry, guild);
					break;
				case AuditLogEvent.MemberUpdate:
					console.log("Miembro actualizado: <@" + entry.targetId + ">\n" + diffConsole(entry.changes, entry.targetType));
					break;
				case AuditLogEvent.MemberRoleUpdate:
					if (![process.env.CLIENT_ID ?? "bot", SLASHBOT_UID, YAGPDB_XYZ_UID, CIRCLE_UID, DYNO_UID].includes(entry.executorId ?? "")) {
						console.log(
							"Roles de <@" +
								entry.targetId +
								"> actualizados por <@" +
								entry.executorId +
								">:\n" +
								diffConsole(entry.changes, entry.targetType)
						);
					}
					break;
				case AuditLogEvent.MemberMove:
					if (entry.extra && "channel" in entry.extra && entry.executorId !== VOICEMASTER_UID)
						console.log(
							ANSI_COLOR.YELLOW +
								"Miembro desconocido movido al canal <#" +
								(entry.extra.channel as GuildChannel).id +
								"> Por <@" +
								entry.executorId +
								">" +
								ANSI_COLOR.RESET
						);
					break;
				case AuditLogEvent.MemberDisconnect:
					ExtendedClient.auditLog(
						"Desconectaron manualmente a alguien del voice",
						"error",
						entry.executorId ?? undefined,
						"voiceLogs"
					);
					break;
				case AuditLogEvent.BotAdd:
					console.log(
						ANSI_COLOR.ORANGE +
							"Bot agregado: <@" +
							entry.targetId +
							">, por <@" +
							entry.executorId +
							">\n" +
							ANSI_COLOR.RESET +
							diffConsole(entry.changes, entry.targetType)
					);
					break;

				// --- ROLE ---
				case AuditLogEvent.RoleUpdate: {
					let newName = entry.changes.find((c) => c.key === "name")?.new;
					if (!newName && entry.target && "name" in entry.target) newName = entry.target?.name as string;
					newName ??= "<nombre desconocido>";
					ExtendedClient.auditLog(
						"Rol actualizado: " + newName + "\n" + diff(entry.changes, entry.targetType),
						"info",
						entry.executor?.username ?? undefined
					);
					break;
				}

				// --- INVITE ---
				case AuditLogEvent.InviteCreate:
					console.log("Invitación creada: " + entry.changes.find((c) => c.key === "code")?.new);
					break;

				// --- MESSAGE ---
				case AuditLogEvent.MessageDelete:
					console.log(ANSI_COLOR.RED + "Mensaje borrado: <#" + entry.targetId + ">" + ANSI_COLOR.RESET);
					break;
				case AuditLogEvent.MessageBulkDelete: {
					let count = "Varios";
					if (entry.extra && "count" in entry.extra) count = entry.extra.count.toString();
					ExtendedClient.auditLog(
						`${count} mensajes borrados: <#${entry.targetId}>`,
						"error",
						entry.executor?.username ?? undefined,
						"logMessages"
					);
					break;
				}

				// --- INTEGRATION ---
				case AuditLogEvent.IntegrationCreate: {
					const integrationId = entry.targetId ?? "";
					let msg: string;

					try {
						// requiere el intent GuildIntegrations
						const integration = (await guild.fetchIntegrations()).get(integrationId);
						if (!integration) break;

						msg =
							`Integración creada: **${integration.name}** (${integration.type})\n` +
							`• Aplicación: ${integration.application?.name ?? "—"}\n` +
							`• Cuenta: ${integration.account?.name ?? "—"}\n` +
							`• Rol gestionado: ${integration.role?.name ?? "—"}\n` +
							`• Subscriptores: ${integration.subscriberCount ?? "—"}\n` +
							`• Sync: ${integration.syncing ? "activo" : "inactivo"}\n` +
							`• Expira en: ${integration.expireGracePeriod ?? "—"} días`;
					} catch {
						// si ya fue borrada o falta intent, usa los cambios mínimos
						msg = `Integración creada (ID ${integrationId}). Cambios: ${diff(entry.changes, entry.targetType)}`;
					}

					ExtendedClient.auditLog(msg, "info", entry.executor?.username ?? undefined);
					break;
				}
				case AuditLogEvent.IntegrationDelete:
					ExtendedClient.auditLog(
						`Integración eliminada (ID ${entry.targetId}). Cambios: ${diff(entry.changes, entry.targetType)}`,
						"error",
						entry.executor?.username ?? undefined
					);
					break;

				// --- STAGE INSTANCE ---
				case AuditLogEvent.StageInstanceCreate:
					handleStageInstanceCreate(entry);
					break;
				case AuditLogEvent.StageInstanceUpdate:
					handleStageInstanceUpdate(entry);
					break;
				case AuditLogEvent.StageInstanceDelete:
					handleStageInstanceDelete(entry);
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
					logThreadCreate(entry);
					break;
				case AuditLogEvent.ThreadUpdate:
					logThreadUpdate(entry);
					break;
				case AuditLogEvent.ThreadDelete:
					logThreadDelete(entry);
					break;

				// --- AUTOMOD ---
				case AuditLogEvent.AutoModerationBlockMessage:
					console.log(
						ANSI_COLOR.ORANGE +
							"Mensaje bloqueado por automod: " +
							JSON.stringify(entry) +
							"\n" +
							ANSI_COLOR.RESET +
							diffConsole(entry.changes, entry.targetType)
					);
					break;
				case AuditLogEvent.AutoModerationFlagToChannel:
					console.log(ANSI_COLOR.ORANGE + "Mensaje de <@" + entry.targetId + "> reportado por automod: " + entry.reason);
					break;

				// --- VOICE STATUS ---
				case 192:
				case 193:
					console.log("Estado de voz cambiado: " + diffConsole(entry.changes, entry.targetType));
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
						"Server Tag (¿actualizado?):\n" + diff(entry.changes, entry.targetType) + ")",
						"info",
						entry.executor?.username ?? undefined
					);
					break;
				default:
					console.error("Evento desconocido:", entry.action, JSON.stringify(entry));
					break;
			}
		} catch (error: any) {
			console.error(`Error en el handler de GuildAuditLogEntryCreate:`, error);
			ExtendedClient.logError("Error en el handler de GuildAuditLogEntryCreate: " + error.message, error.stack, process.env.CLIENT_ID);
		}
	},
} as Evento;
export function fmt(key: string, v: any, type: GuildAuditLogsEntry["targetType"]) {
	if (key === "scheduled_start_time" || key === "scheduled_end_time" || key === "scheduledStartTimestamp") {
		let ms: number = NaN;
		if (typeof v === "string") {
			ms = Date.parse(v);
		} else if (typeof v === "number") {
			ms = v;
		}
		if (!Number.isNaN(ms)) return `<t:${Math.floor(ms / 1000)}:F>`;
	}
	if ((key === "color" || key === "primary_color" || key === "secondary_color" || key === "tertiary_color") && typeof v === "number")
		return `0x${v.toString(16).padStart(6, "0")}`;
	if (type === "GuildScheduledEvent" && key === "status") {
		switch (v) {
			case GuildScheduledEventStatus.Active:
				return "Iniciado";
			case GuildScheduledEventStatus.Canceled:
				return "Cancelado";
			case GuildScheduledEventStatus.Completed:
				return "Completado";
			case GuildScheduledEventStatus.Scheduled:
				return "Programado";
			default:
				return "Desconocido";
		}
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
export function diff(changes: GuildAuditLogsEntry["changes"] | undefined, type: GuildAuditLogsEntry["targetType"]): string {
	if (!changes?.length) return "Sin detalles";

	const lines: string[] = [];

	for (const c of changes) {
		if (c.old === c.new) continue;
		if (typeof c.old === "object" && c.old && typeof c.new === "object" && c.new) {
			const keys = new Set([...Object.keys(c.old as Record<string, unknown>), ...Object.keys(c.new as Record<string, unknown>)]);

			for (const k of keys) {
				const oldVal = (c.old as Record<string, unknown>)[k];
				const newVal = (c.new as Record<string, unknown>)[k];
				if (oldVal !== newVal) lines.push(`• **${k}**: ${fmt(k, oldVal, type)} → ${fmt(k, newVal, type)}`);
			}
		} else {
			lines.push(`• **${c.key}**: ${fmt(c.key, c.old, type)} → ${fmt(c.key, c.new, type)}`);
		}
	}

	return lines.join("\n") || "Sin detalles";
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

export function diffConsole(changes: GuildAuditLogsEntry["changes"] | undefined, type: GuildAuditLogsEntry["targetType"]): string {
	if (!changes?.length) return "Sin detalles";
	return changes
		.map((c, i) => {
			const isLast = i === changes.length - 1;
			const bullet = isLast ? "└" : "├";
			const color = getColor(c.key);
			return `${ANSI_COLOR.GRAY}${bullet}${ANSI_COLOR.RESET} ${color}${c.key}${ANSI_COLOR.RESET}: ${fmt(c.key, c.old, type)} → ${fmt(
				c.key,
				c.new,
				type
			)}`;
		})
		.join("\n");
}
