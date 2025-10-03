import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";

export const inviteHandlers: AuditLogHandlers = {
	[AuditLogEvent.InviteCreate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.InviteCreate>, guild: Guild) => {
		console.log("Invitación creada: " + entry.changes.find((c) => c.key === "code")?.new);
	},
};

