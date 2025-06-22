import { GuildAuditLogsEntry } from "discord.js";
import { ANSI_COLOR } from "../../utils/constants.js";
import { diffConsole } from "../guildAuditLogEntryCreate.js";

export function logThreadCreate(entry: GuildAuditLogsEntry) {
	if (entry.executorId !== process.env.CLIENT_ID) {
		const name = entry.changes?.find((c) => c.key === "name")?.new ?? "Sin título";
		console.log(ANSI_COLOR.GREEN + "Hilo creado: <#" + entry.targetId + ">:" + name + ANSI_COLOR.RESET);
	}
}

export function logThreadUpdate(entry: GuildAuditLogsEntry) {
	if (entry.executorId !== process.env.CLIENT_ID) {
		console.log(
			ANSI_COLOR.YELLOW + "Hilo actualizado: <#" + entry.targetId + ">\n" + ANSI_COLOR.RESET + diffConsole(entry.changes, entry.targetType)
		);
	}
}

export function logThreadDelete(entry: GuildAuditLogsEntry) {
	if (entry.executorId !== process.env.CLIENT_ID) {
		const name = entry.changes?.find((c) => c.key === "name")?.old ?? "Sin título";
		console.log(ANSI_COLOR.RED + "Hilo eliminado: <#" + entry.targetId + ">:" + name + ANSI_COLOR.RESET);
	}
}
