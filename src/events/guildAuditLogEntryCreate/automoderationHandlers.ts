import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { ANSI_COLOR } from "../../utils/constants.js";
import { diffConsole } from "./utils.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";

export const automoderationHandlers: AuditLogHandlers = {
	[AuditLogEvent.AutoModerationBlockMessage]: async (entry: GuildAuditLogsEntry<AuditLogEvent.AutoModerationBlockMessage>, guild: Guild) => {
		console.log(
			ANSI_COLOR.ORANGE +
				"Mensaje bloqueado por automod: " +
				ANSI_COLOR.RESET +
				JSON.stringify(entry) +
				"\n" +
				diffConsole(entry.changes, entry.targetType)
		);
	},

	[AuditLogEvent.AutoModerationFlagToChannel]: async (
		entry: GuildAuditLogsEntry<AuditLogEvent.AutoModerationFlagToChannel>,
		guild: Guild
	) => {
		console.log(ANSI_COLOR.ORANGE + "Mensaje de <@" + entry.targetId + "> reportado por automod: " + ANSI_COLOR.RESET + entry.reason);
	},
};

