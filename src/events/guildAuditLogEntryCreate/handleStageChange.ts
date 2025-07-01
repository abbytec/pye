import { GuildAuditLogsEntry } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { diff } from "../guildAuditLogEntryCreate.js";

export function handleStageInstanceCreate(entry: GuildAuditLogsEntry) {
	const channel = entry.extra && "channel" in entry.extra ? "<#" + entry.extra.channel.id + ">" : "Canal desconocido";
	ExtendedClient.auditLog(
		"Escenario iniciado: " + channel + "\n Tema: " + (entry.changes.find((c) => c.key === "topic")?.new ?? "Desconocido"),
		"success",
		entry.executor?.username ?? undefined,
		"voiceLogs"
	);
}

export function handleStageInstanceUpdate(entry: GuildAuditLogsEntry) {
	const channel = entry.extra && "channel" in entry.extra ? "<#" + entry.extra.channel.id + ">" : "Canal desconocido";
	ExtendedClient.auditLog(
		"Escenario actualizado: " + channel + "\n" + diff(entry.changes, entry.targetType),
		"info",
		entry.executor?.username ?? undefined,
		"voiceLogs"
	);
}

export function handleStageInstanceDelete(entry: GuildAuditLogsEntry) {
	const channel = entry.extra && "channel" in entry.extra ? "<#" + entry.extra.channel.id + ">" : "Canal desconocido";
	ExtendedClient.auditLog(
		"Escenario finalizado:  " + channel + "\n Tema: " + (entry.changes.find((c) => c.key === "topic")?.old ?? "Desconocido"),
		"error",
		entry.executor?.username ?? undefined,
		"voiceLogs"
	);
}
