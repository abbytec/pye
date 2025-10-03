import { Guild, GuildAuditLogsEntry } from "discord.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";
import { diffConsole } from "./utils.js";

export const voiceStatusHandlers: AuditLogHandlers = {
	// Eventos extra no oficiales para estado de voz
	192: async (entry: GuildAuditLogsEntry<any>, guild: Guild) => {
		console.log("Estado de voz cambiado: " + diffConsole(entry.changes, entry.targetType));
	},

	193: async (entry: GuildAuditLogsEntry<any>, guild: Guild) => {
		console.log("Estado de voz cambiado: " + diffConsole(entry.changes, entry.targetType));
	},
};

