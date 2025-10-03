import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";
import { handleStageInstanceCreate, handleStageInstanceDelete, handleStageInstanceUpdate } from "./handleStageChange.js";

export const stageHandlers: AuditLogHandlers = {
	[AuditLogEvent.StageInstanceCreate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.StageInstanceCreate>, guild: Guild) => {
		handleStageInstanceCreate(entry);
	},

	[AuditLogEvent.StageInstanceUpdate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.StageInstanceUpdate>, guild: Guild) => {
		handleStageInstanceUpdate(entry);
	},

	[AuditLogEvent.StageInstanceDelete]: async (entry: GuildAuditLogsEntry<AuditLogEvent.StageInstanceDelete>, guild: Guild) => {
		handleStageInstanceDelete(entry);
	},
};

