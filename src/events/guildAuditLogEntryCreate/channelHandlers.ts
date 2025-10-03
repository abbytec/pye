import { AuditLogEvent, ChannelType, Guild, GuildAuditLogsEntry } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { ANSI_COLOR } from "../../utils/constants.js";
import { ticketTypes } from "../../utils/constants/ticketOptions.js";
import { diff, diffConsole } from "./utils.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";

export const channelHandlers: AuditLogHandlers = {
	[AuditLogEvent.ChannelCreate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.ChannelCreate>, guild: Guild) => {
		if (entry.target && "name" in entry.target && "type" in entry.target) {
			const channelName = entry.target.name as string;
			if (
				entry.executorId === process.env.CLIENT_ID &&
				(ticketTypes.some((type) => channelName.includes(type)) || channelName.startsWith("warn"))
			)
				return;
			ExtendedClient.auditLog(
				"Canal creado : " + channelName,
				"success",
				entry.executor?.username ?? undefined,
				entry.target.type === ChannelType.GuildVoice ? "voiceLogs" : "logs"
			);
		}
	},

	[AuditLogEvent.ChannelUpdate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.ChannelUpdate>, guild: Guild) => {
		if (entry.target && "type" in entry.target)
			ExtendedClient.auditLog(
				"Canal Actualizado <#" + entry.targetId + ">\n Cambios:\n" + diff(entry.changes, entry.targetType),
				"info",
				entry.executor?.username ?? undefined,
				entry.target.type === ChannelType.GuildVoice ? "voiceLogs" : "logs"
			);
	},

	[AuditLogEvent.ChannelDelete]: async (entry: GuildAuditLogsEntry<AuditLogEvent.ChannelDelete>, guild: Guild) => {
		if (entry.target && "name" in entry.target && "type" in entry.target) {
			const channelName = entry.target.name as string;
			if (
				entry.executorId === process.env.CLIENT_ID &&
				(ticketTypes.some((type) => channelName.includes(type)) || channelName.startsWith("warn"))
			)
				return;
			ExtendedClient.auditLog(
				"Canal eliminado: " + channelName,
				"error",
				entry.executor?.username ?? undefined,
				entry.target.type === ChannelType.GuildVoice ? "voiceLogs" : "logs"
			);
		}
	},

	[AuditLogEvent.ChannelOverwriteCreate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.ChannelOverwriteCreate>, guild: Guild) => {
		if (entry.executorId !== process.env.CLIENT_ID) {
			console.log(
				ANSI_COLOR.GREEN +
					"Permisos especificos agregados en el canal <#" +
					entry.targetId +
					">\n" +
					ANSI_COLOR.RESET +
					diffConsole(entry.changes, entry.targetType)
			);
		}
	},

	[AuditLogEvent.ChannelOverwriteUpdate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.ChannelOverwriteUpdate>, guild: Guild) => {
		if (entry.executorId !== process.env.CLIENT_ID) {
			console.log(
				ANSI_COLOR.YELLOW +
					"Permisos especificos modificados en el canal <#" +
					entry.targetId +
					">\n" +
					ANSI_COLOR.RESET +
					diffConsole(entry.changes, entry.targetType)
			);
		}
	},
};

