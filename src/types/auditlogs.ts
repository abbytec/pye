import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";

/** Eventos extra no listados en el enum oficial */
export type ExtraAuditLogEvent = 200 | 201 | 202 | 211 | 192 | 193;

/** Todos los eventos que queremos soportar */
export type AllAuditLogEvent = AuditLogEvent | ExtraAuditLogEvent;

/** Handler específico según el tipo de evento:
 * - si E es un AuditLogEvent oficial → GuildAuditLogsEntry<E>
 * - si es un evento extra → GuildAuditLogsEntry<number> (puede ajustarse si conocés el shape)
 */
type HandlerFor<E> = E extends AuditLogEvent
	? (entry: GuildAuditLogsEntry<E>, guild: Guild) => Promise<void> | void
	: (entry: GuildAuditLogsEntry<any>, guild: Guild) => Promise<void> | void;

/** Mapa tipado: cada clave (oficial o extra) puede tener su handler específico */
export type AuditLogHandlers = Partial<{ [E in AllAuditLogEvent]: HandlerFor<E> }>;

