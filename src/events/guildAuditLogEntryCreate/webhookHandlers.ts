import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { ANSI_COLOR } from "../../utils/constants.js";
import { diffConsole } from "./utils.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";

export const webhookHandlers: AuditLogHandlers = {
	[AuditLogEvent.WebhookCreate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.WebhookCreate>, guild: Guild) => {
		console.log(ANSI_COLOR.BLUE + "Webhook creado: " + ANSI_COLOR.RESET + diffConsole(entry.changes, entry.targetType));
	},

	[AuditLogEvent.WebhookUpdate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.WebhookUpdate>, guild: Guild) => {
		console.log(ANSI_COLOR.BLUE + "Webhook actualizado: " + ANSI_COLOR.RESET + diffConsole(entry.changes, entry.targetType));
	},

	[AuditLogEvent.WebhookDelete]: async (entry: GuildAuditLogsEntry<AuditLogEvent.WebhookDelete>, guild: Guild) => {
		console.log(ANSI_COLOR.RED + "Webhook eliminado: " + ANSI_COLOR.RESET + diffConsole(entry.changes, entry.targetType));
	},
};

