// src/events/guildAuditLogEntryCreate.ts
import { AuditLogEvent, Events, Guild, GuildAuditLogsEntry } from "discord.js";
import { Evento } from "../types/event.js";
import { ExtendedClient } from "../client.js";
import { handleBanAdd } from "./guildAuditLogEntryCreate/handleBanAdd.js";
import { handleBanRemove } from "./guildAuditLogEntryCreate/handleBanRemove.js";
import {
	logEventCreated,
	logEventDeleted,
	logEventUpdated,
	logSeriesInstanceCreate,
	logSeriesInstanceReset,
	logSeriesInstanceUpdate,
} from "./guildAuditLogEntryCreate/handleEventChange.js";

export default {
	name: Events.GuildAuditLogEntryCreate,
	once: false,
	async execute(entry: GuildAuditLogsEntry, guild: Guild) {
		try {
			switch (entry.action as number) {
				case AuditLogEvent.ChannelCreate:
					// Lógica para creación de canal
					console.log("Canal creado:", entry.targetId, entry.executorId);
					break;
				case AuditLogEvent.ChannelDelete:
					// Lógica para borrado de canal
					console.log("Canal borrado:", entry.targetId, entry.executorId);
					break;
				case AuditLogEvent.ChannelUpdate:
					// Lógica para actualización de canal
					console.log("Canal modificado:", entry.targetId, entry.executorId, entry.changes);
					break;
				case AuditLogEvent.GuildScheduledEventCreate:
					// Lógica para creación de evento
					await logEventCreated(entry, guild);
					break;
				case AuditLogEvent.GuildScheduledEventUpdate:
					// Lógica para modificación de evento
					await logEventUpdated(entry, guild);
					break;
				case AuditLogEvent.GuildScheduledEventDelete:
					// Lógica para borrado de evento
					await logEventDeleted(entry, guild);
					break;
				case AuditLogEvent.MemberBanAdd:
					// Lógica para baneo de miembro
					await handleBanAdd(entry, guild);
					break;
				case AuditLogEvent.MemberBanRemove:
					// Lógica para desbaneo de miembro
					await handleBanRemove(entry, guild);
					break;
				case 200:
					await logSeriesInstanceCreate(entry, guild);
					break;
				case 201:
					await logSeriesInstanceUpdate(entry, guild);
					break;
				case 202:
					await logSeriesInstanceReset(entry, guild);
					break;
				default:
					console.log("Evento desconocido:", entry.action, JSON.stringify(entry));
					break;
			}
		} catch (error: any) {
			console.error(`Error en el handler de GuildAuditLogEntryCreate:`, error);
			ExtendedClient.logError("Error en el handler de GuildAuditLogEntryCreate: " + error.message, error.stack, process.env.CLIENT_ID);
		}
	},
} as Evento;
