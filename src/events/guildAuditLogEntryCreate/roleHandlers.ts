import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { diff } from "./utils.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";

export const roleHandlers: AuditLogHandlers = {
	[AuditLogEvent.RoleCreate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.RoleCreate>, guild: Guild) => {
		ExtendedClient.auditLog(
			"Rol creado: " + entry.changes.find((c) => c.key === "name")?.new,
			"success",
			entry.executor?.username ?? undefined
		);
	},

	[AuditLogEvent.RoleUpdate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.RoleUpdate>, guild: Guild) => {
		let newName = entry.changes.find((c) => c.key === "name")?.new;
		if (!newName && entry.target && "name" in entry.target) newName = entry.target?.name as string;
		newName ??= "<nombre desconocido>";
		ExtendedClient.auditLog(
			"Rol actualizado: " + newName + "\n" + diff(entry.changes, entry.targetType),
			"info",
			entry.executor?.username ?? undefined
		);
	},

	[AuditLogEvent.RoleDelete]: async (entry: GuildAuditLogsEntry<AuditLogEvent.RoleDelete>, guild: Guild) => {
		ExtendedClient.auditLog(
			"Rol eliminado: " + entry.changes.find((c) => c.key === "name")?.old,
			"error",
			entry.executor?.username ?? undefined
		);
	},
};

