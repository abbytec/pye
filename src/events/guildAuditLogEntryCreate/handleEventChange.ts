// src/handlers/audit/handleEventChange.ts
import { AuditLogEvent, EmbedBuilder, Guild, GuildAuditLogsEntry, GuildScheduledEvent, TextChannel } from "discord.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";

/** Devuelve el canal #logs o null si no existe/está mal configurado */
function getLogChannel(guild: Guild): TextChannel | null {
	return guild.channels.resolve(getChannelFromEnv("logs")) as TextChannel | null;
}

function fmt(key: string, v: any) {
	if (key === "scheduled_start_time" || key === "scheduled_end_time" || key === "scheduledStartTimestamp") {
		let ms: number;
		if (typeof v === "string") {
			ms = Date.parse(v);
		} else if (typeof v === "number") {
			ms = v;
		} else {
			ms = NaN;
		}
		if (!Number.isNaN(ms)) return `<t:${Math.floor(ms / 1000)}:F>`;
	}
	return `\`${v ?? "null"}\``; // resto de claves
}

type AuditChange = { key: string; old?: unknown; new?: unknown };
/** Formatea un `GuildScheduledEvent` a texto breve */
async function formatEventFromEntry(entry: GuildAuditLogsEntry, guild: Guild): Promise<string> {
	// 1️⃣  Datos directos del evento (si existen)
	const evt = await eventFromEntry(entry, guild);
	let name = "";
	if (evt && "name" in evt) name = evt.name;
	let start;
	// 2️⃣  Completar con los cambios del audit-log
	for (const c of (entry.changes as unknown as AuditChange[]) ?? []) {
		const key = c.key;
		const raw = c.new ?? c.old;
		if (key === "name") {
			if (typeof raw === "string") name = raw;
		}

		if (key === "scheduled_start_time" || key === "scheduledStartTimestamp") {
			start = fmt(key, raw);
		}
	}

	const id = evt?.id ?? entry.targetId ?? "¿sin ID?";

	return `**${name ?? "Evento desconocido"}**\nID: ${id})\n${start ? "Inicio: " + start : ""}`;
}

function diff(changes: GuildAuditLogsEntry["changes"] | undefined): string {
	return changes?.map((c) => `• **${c.key}**: ${fmt(c.key, c.old)} → ${fmt(c.key, c.new)}`).join("\n") ?? "Sin detalles";
}

/** Crea un embed común para los tres casos */
function baseEmbed(
	title: string,
	color: number,
	executorTag: string,
	eventText: string,
	extra?: { name: string; value: string; inline?: boolean }[]
) {
	return new EmbedBuilder()
		.setTitle(title)
		.setColor(color)
		.addFields({ name: "Ejecutor", value: executorTag, inline: true }, { name: "Evento", value: eventText, inline: true }, ...(extra ?? []))
		.setTimestamp();
}

/* --------------- MÉTODOS PÚBLICOS --------------- */

/** Evento creado */
export async function logEventCreated(entry: GuildAuditLogsEntry, guild: Guild) {
	const logChan = getLogChannel(guild);
	if (!logChan) return;

	const embed = baseEmbed(
		"📅 Evento creado",
		COLORS.okGreen,
		entry.executor?.tag ?? "¿desconocido?",
		await formatEventFromEntry(entry, guild)
	);
	await logChan.send({ embeds: [embed] });
}

/** Evento actualizado */
export async function logEventUpdated(entry: GuildAuditLogsEntry, guild: Guild) {
	const logChan = getLogChannel(guild);
	if (!logChan) return;
	const embed = baseEmbed(
		"✏️ Evento actualizado",
		COLORS.pyeLightBlue,
		entry.executor?.tag ?? "¿desconocido?",
		await formatEventFromEntry(entry, guild),
		[{ name: "Cambios", value: diff(entry.changes) }]
	);
	await logChan.send({ embeds: [embed] });
}

/** Evento borrado */
export async function logEventDeleted(entry: GuildAuditLogsEntry, guild: Guild) {
	const logChan = getLogChannel(guild);
	if (!logChan) return;

	const embed = baseEmbed(
		"🗑️ Evento eliminado",
		COLORS.errRed,
		entry.executor?.tag ?? "¿desconocido?",
		await formatEventFromEntry(entry, guild)
	);
	await logChan.send({ embeds: [embed] });
}

async function eventFromEntry(entry: GuildAuditLogsEntry, guild: Guild) {
	// 1️⃣  El objeto "target" normalmente ya es GuildScheduledEvent o un wrapper parcial
	const evt = entry.target as GuildScheduledEvent | null;
	if (evt?.name) return evt; // suficiente para create / delete

	// 2️⃣  Para updates, el estado final NO viene completo,
	//     pero podés reconstruirlo a partir de los cambios:
	if (entry.action === AuditLogEvent.GuildScheduledEventUpdate) {
		const rebuilt = { id: entry.targetId ?? "" } as any;
		for (const c of entry.changes ?? []) {
			rebuilt[c.key] = c.new as never;
		}
		return rebuilt as GuildScheduledEvent;
	}
	return guild.scheduledEvents.resolve(entry.targetId ?? "") ?? null; // cae acá si no hay info.
}

/** action === 200 - instancia individual creada o diferenciada de la serie */
export async function logSeriesInstanceCreate(entry: GuildAuditLogsEntry, guild: Guild) {
	const chan = getLogChannel(guild);
	if (!chan) return;

	const embed = baseEmbed(
		"⏰ Evento individual desviado de la serie",
		COLORS.pyeLightBlue,
		entry.executor?.tag ?? entry.executorId ?? "¿desconocido?",
		await formatEventFromEntry(entry, guild),
		[{ name: "Cambios", value: diff(entry.changes) }]
	);
	await chan.send({ embeds: [embed] });
}

/** action === 201 - instancia ya diferenciada, se vuelve a modificar */
export async function logSeriesInstanceUpdate(entry: GuildAuditLogsEntry, guild: Guild) {
	const chan = getLogChannel(guild);
	if (!chan) return;

	const embed = baseEmbed(
		"✏️ Instancia individual de un evento actualizada",
		COLORS.pyeLightBlue,
		entry.executor?.tag ?? entry.executorId ?? "¿desconocido?",
		await formatEventFromEntry(entry, guild),
		[{ name: "Cambios", value: diff(entry.changes) }]
	);
	await chan.send({ embeds: [embed] });
}

/** action === 202 - instancia restablecida al horario default de la serie */
export async function logSeriesInstanceReset(entry: GuildAuditLogsEntry, guild: Guild) {
	const chan = getLogChannel(guild);
	if (!chan) return;

	const embed = baseEmbed(
		"↩️ Instancia inidividual de un evento restablecida a la serie",
		COLORS.warnOrange,
		entry.executor?.tag ?? entry.executorId ?? "¿desconocido?",
		await formatEventFromEntry(entry, guild),
		[{ name: "Cambios", value: diff(entry.changes) }]
	);
	await chan.send({ embeds: [embed] });
}
