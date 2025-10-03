import { Guild, GuildAuditLogsEntry } from "discord.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";
import { logSeriesInstanceCreate, logSeriesInstanceReset, logSeriesInstanceUpdate } from "./handleEventChange.js";

export const scheduledEventInstanceHandlers: AuditLogHandlers = {
	// Eventos extra no oficiales
	200: async (entry: GuildAuditLogsEntry<any>, guild: Guild) => {
		await logSeriesInstanceCreate(entry, guild);
	},

	201: async (entry: GuildAuditLogsEntry<any>, guild: Guild) => {
		await logSeriesInstanceUpdate(entry, guild);
	},

	202: async (entry: GuildAuditLogsEntry<any>, guild: Guild) => {
		await logSeriesInstanceReset(entry, guild);
	},
};

