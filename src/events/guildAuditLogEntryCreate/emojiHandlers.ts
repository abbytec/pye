import { AuditLogEvent } from "discord.js";
import { ANSI_COLOR } from "../../utils/constants.js";
import { diffConsole } from "./utils.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";

export const emojiHandlers: AuditLogHandlers = {
	[AuditLogEvent.EmojiCreate]: (entry) => {
		console.log(ANSI_COLOR.BLUE + "Emoji creado: " + ANSI_COLOR.RESET + diffConsole(entry.changes, entry.targetType));
	},
	[AuditLogEvent.EmojiUpdate]: (entry) => {
		console.log(ANSI_COLOR.BLUE + "Emoji actualizado: " + ANSI_COLOR.RESET + diffConsole(entry.changes, entry.targetType));
	},
	[AuditLogEvent.EmojiDelete]: (entry) => {
		console.log(ANSI_COLOR.RED + "Emoji eliminado: " + ANSI_COLOR.RESET + diffConsole(entry.changes, entry.targetType));
	},
};