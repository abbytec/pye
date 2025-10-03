import { AuditLogEvent, Guild, GuildAuditLogsEntry, GuildChannel } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { ANSI_COLOR, DYNO_UID, SLASHBOT_UID, VOICEMASTER_UID, YAGPDB_XYZ_UID, CIRCLE_UID } from "../../utils/constants.js";
import { diffConsole } from "./utils.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";
import { handleBanAdd } from "./handleBanAdd.js";
import { handleBanRemove } from "./handleBanRemove.js";
import { handleMemberKick } from "./handleMemberKick.js";

export const memberHandlers: AuditLogHandlers = {
	[AuditLogEvent.MemberKick]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MemberKick>, guild: Guild) => {
		await handleMemberKick(entry, guild);
	},

	[AuditLogEvent.MemberBanAdd]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MemberBanAdd>, guild: Guild) => {
		await handleBanAdd(entry, guild);
	},

	[AuditLogEvent.MemberBanRemove]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MemberBanRemove>, guild: Guild) => {
		await handleBanRemove(entry, guild);
	},

	[AuditLogEvent.MemberUpdate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MemberUpdate>, guild: Guild) => {
		if (entry.executorId !== process.env.CLIENT_ID)
			console.log("Miembro actualizado: <@" + entry.targetId + ">\n" + diffConsole(entry.changes, entry.targetType));
	},

	[AuditLogEvent.MemberRoleUpdate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MemberRoleUpdate>, guild: Guild) => {
		if (![process.env.CLIENT_ID ?? "bot", SLASHBOT_UID, YAGPDB_XYZ_UID, CIRCLE_UID, DYNO_UID].includes(entry.executorId ?? "")) {
			console.log(
				"Roles de <@" +
					entry.targetId +
					"> actualizados por <@" +
					entry.executorId +
					">:\n" +
					diffConsole(entry.changes, entry.targetType)
			);
		}
	},

	[AuditLogEvent.MemberMove]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MemberMove>, guild: Guild) => {
		if (entry.extra && "channel" in entry.extra && entry.executorId !== VOICEMASTER_UID)
			console.log(
				ANSI_COLOR.YELLOW +
					"Miembro desconocido movido al canal <#" +
					(entry.extra.channel as GuildChannel).id +
					"> Por <@" +
					entry.executorId +
					">" +
					ANSI_COLOR.RESET
			);
	},

	[AuditLogEvent.MemberDisconnect]: async (entry: GuildAuditLogsEntry<AuditLogEvent.MemberDisconnect>, guild: Guild) => {
		ExtendedClient.auditLog("Desconectaron manualmente a alguien del voice", "error", entry.executorId ?? undefined, "voiceLogs");
	},

	[AuditLogEvent.BotAdd]: async (entry: GuildAuditLogsEntry<AuditLogEvent.BotAdd>, guild: Guild) => {
		console.log(
			ANSI_COLOR.ORANGE +
				"Bot agregado: <@" +
				entry.targetId +
				">, por <@" +
				entry.executorId +
				">\n" +
				ANSI_COLOR.RESET +
				diffConsole(entry.changes, entry.targetType)
		);
	},
};

