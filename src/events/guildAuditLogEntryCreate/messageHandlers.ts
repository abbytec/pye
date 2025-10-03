import { AuditLogEvent, Guild, GuildAuditLogsEntry, GuildAuditLogsEntryExtraField } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { ANSI_COLOR } from "../../utils/constants.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";

export const messageHandlers: AuditLogHandlers = {
	[AuditLogEvent.MessageDelete]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MessageDelete>, guild: Guild) => {
		console.log(ANSI_COLOR.RED + "Mensaje borrado: <#" + entry.targetId + ">" + ANSI_COLOR.RESET);
	},

	[AuditLogEvent.MessageBulkDelete]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MessageBulkDelete>, guild: Guild) => {
		let count = "Varios";
		if (entry.extra && "count" in entry.extra) count = entry.extra.count.toString();
		ExtendedClient.auditLog(`${count} mensajes borrados: <#${entry.targetId}>`, "error", entry.executor?.username ?? undefined, "logMessages");
	},

	[AuditLogEvent.MessagePin]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MessagePin>, guild: Guild) => {
		ExtendedClient.auditLog(
			"Mensaje pinneado: https://discord.com/channels/" +
				process.env.GUILD_ID +
				"/" +
				(entry.extra as GuildAuditLogsEntryExtraField[AuditLogEvent.MessagePin])?.channel.id +
				"/" +
				(entry.extra as GuildAuditLogsEntryExtraField[AuditLogEvent.MessagePin])?.messageId,
			"success",
			entry.executor?.username ?? undefined,
			"logMessages"
		);
	},

	[AuditLogEvent.MessageUnpin]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MessageUnpin>, guild: Guild) => {
		ExtendedClient.auditLog(
			"Mensaje despinneado: https://discord.com/channels/" +
				process.env.GUILD_ID +
				"/" +
				(entry.extra as GuildAuditLogsEntryExtraField[AuditLogEvent.MessageUnpin])?.channel.id +
				"/" +
				(entry.extra as GuildAuditLogsEntryExtraField[AuditLogEvent.MessageUnpin])?.messageId,
			"error",
			entry.executor?.username ?? undefined,
			"logMessages"
		);
	},
};

