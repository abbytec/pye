import { Guild, GuildAuditLogsEntry } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";
import { diff } from "./utils.js";

export const serverHandlers: AuditLogHandlers = {
	// Evento extra no oficial para server tags
	211: async (entry: GuildAuditLogsEntry<any>, guild: Guild) => {
		ExtendedClient.auditLog("Server Tag (¿actualizado?):\n" + diff(entry.changes, entry.targetType) + ")", "info", entry.executor?.username ?? undefined);
	},
};

