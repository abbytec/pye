import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";
import { logEventCreated, logEventDeleted, logEventUpdated } from "./handleEventChange.js";

export const scheduledEventHandlers: AuditLogHandlers = {
	[AuditLogEvent.GuildScheduledEventCreate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.GuildScheduledEventCreate>, guild: Guild) => {
		await logEventCreated(entry, guild);
	},

	[AuditLogEvent.GuildScheduledEventUpdate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.GuildScheduledEventUpdate>, guild: Guild) => {
		await logEventUpdated(entry, guild);
	},

	[AuditLogEvent.GuildScheduledEventDelete]: async (entry: GuildAuditLogsEntry<AuditLogEvent.GuildScheduledEventDelete>, guild: Guild) => {
		await logEventDeleted(entry, guild);
	},
};

