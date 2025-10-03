import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";
import { logThreadCreate, logThreadDelete, logThreadUpdate } from "./handleThreadAction.js";

export const threadHandlers: AuditLogHandlers = {
	[AuditLogEvent.ThreadCreate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.ThreadCreate>, guild: Guild) => {
		logThreadCreate(entry);
	},

	[AuditLogEvent.ThreadUpdate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.ThreadUpdate>, guild: Guild) => {
		logThreadUpdate(entry);
	},

	[AuditLogEvent.ThreadDelete]: async (entry: GuildAuditLogsEntry<AuditLogEvent.ThreadDelete>, guild: Guild) => {
		logThreadDelete(entry);
	},
};

