import { Events, Guild, GuildAuditLogsEntry } from "discord.js";
import { Evento } from "../types/event.js";
import { ExtendedClient } from "../client.js";
import { AllAuditLogEvent, AuditLogHandlers } from "../types/auditlogs.js";
import { channelHandlers } from "./guildAuditLogEntryCreate/channelHandlers.js";
import { memberHandlers } from "./guildAuditLogEntryCreate/memberHandlers.js";
import { roleHandlers } from "./guildAuditLogEntryCreate/roleHandlers.js";
import { inviteHandlers } from "./guildAuditLogEntryCreate/inviteHandlers.js";
import { webhookHandlers } from "./guildAuditLogEntryCreate/webhookHandlers.js";
import { messageHandlers } from "./guildAuditLogEntryCreate/messageHandlers.js";
import { integrationHandlers } from "./guildAuditLogEntryCreate/integrationHandlers.js";
import { commandHandlers } from "./guildAuditLogEntryCreate/commandHandlers.js";
import { stageHandlers } from "./guildAuditLogEntryCreate/stageHandlers.js";
import { scheduledEventHandlers } from "./guildAuditLogEntryCreate/scheduledEventHandlers.js";
import { threadHandlers } from "./guildAuditLogEntryCreate/threadHandlers.js";
import { automoderationHandlers } from "./guildAuditLogEntryCreate/automoderationHandlers.js";
import { voiceStatusHandlers } from "./guildAuditLogEntryCreate/voiceStatusHandlers.js";
import { scheduledEventInstanceHandlers } from "./guildAuditLogEntryCreate/scheduledEventInstanceHandlers.js";
import { serverHandlers } from "./guildAuditLogEntryCreate/serverHandlers.js";

const handlers: AuditLogHandlers = {
	...channelHandlers,
	...memberHandlers,
	...roleHandlers,
	...inviteHandlers,
	...webhookHandlers,
	...messageHandlers,
	...integrationHandlers,
	...commandHandlers,
	...stageHandlers,
	...scheduledEventHandlers,
	...threadHandlers,
	...automoderationHandlers,
	...voiceStatusHandlers,
	...scheduledEventInstanceHandlers,
	...serverHandlers,
};

async function dispatchAuditLog(entry: GuildAuditLogsEntry, guild: Guild, handlers: AuditLogHandlers): Promise<boolean> {
	const key = entry.action as AllAuditLogEvent;
	const h = handlers[key];
	if (!h) return false;
	await h(entry as any, guild);
	return true;
}

export default {
	name: Events.GuildAuditLogEntryCreate,
	once: false,
	async execute(entry: GuildAuditLogsEntry, guild: Guild) {
		try {
			const ok = await dispatchAuditLog(entry, guild, handlers);
			if (!ok) console.error("Evento desconocido:", entry.action, JSON.stringify(entry));
		} catch (error: any) {
			console.error(`Error en el handler de GuildAuditLogEntryCreate:`, error);
			ExtendedClient.logError("Error en el handler de GuildAuditLogEntryCreate: " + error.message, error.stack, process.env.CLIENT_ID);
		}
	},
} as Evento;

// Re-exportar utilidades para mantener compatibilidad
export { fmt, diff, diffConsole, getColor } from "./guildAuditLogEntryCreate/utils.js";
