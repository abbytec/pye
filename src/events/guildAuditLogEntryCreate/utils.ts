import { GuildAuditLogsEntry, GuildScheduledEventStatus } from "discord.js";
import { ANSI_COLOR } from "../../utils/constants.js";

export function fmt(key: string, v: any, type: GuildAuditLogsEntry["targetType"]) {
	if (key === "scheduled_start_time" || key === "scheduled_end_time" || key === "scheduledStartTimestamp") {
		let ms: number = NaN;
		if (typeof v === "string") {
			ms = Date.parse(v);
		} else if (typeof v === "number") {
			ms = v;
		}
		if (!Number.isNaN(ms)) return `<t:${Math.floor(ms / 1000)}:F>`;
	}
	if ((key === "color" || key === "primary_color" || key === "secondary_color" || key === "tertiary_color") && typeof v === "number")
		return `0x${v.toString(16).padStart(6, "0")}`;
	if (type === "GuildScheduledEvent" && key === "status") {
		switch (v) {
			case GuildScheduledEventStatus.Active:
				return "Iniciado";
			case GuildScheduledEventStatus.Canceled:
				return "Cancelado";
			case GuildScheduledEventStatus.Completed:
				return "Completado";
			case GuildScheduledEventStatus.Scheduled:
				return "Programado";
			default:
				return "Desconocido";
		}
	}
	if (typeof v === "string" || typeof v === "number") return `${v}`;
	else if (typeof v === "object")
		try {
			return JSON.stringify(v);
		} catch (error) {
			console.error("Error formateando el valor clave de auditoria:", v, error);
		}
	else if (typeof v === "boolean") return getColor(v ? "$add" : "$remove") + `${v}` + ANSI_COLOR.RESET;
	return "`null`"; // resto de claves
}

export function diff(changes: GuildAuditLogsEntry["changes"] | undefined, type: GuildAuditLogsEntry["targetType"]): string {
	if (!changes?.length) return "Sin detalles";

	const lines: string[] = [];

	for (const c of changes) {
		if (c.old === c.new) continue;
		if (typeof c.old === "object" && c.old && typeof c.new === "object" && c.new) {
			const keys = new Set([...Object.keys(c.old as Record<string, unknown>), ...Object.keys(c.new as Record<string, unknown>)]);

			for (const k of keys) {
				const oldVal = (c.old as Record<string, unknown>)[k];
				const newVal = (c.new as Record<string, unknown>)[k];
				if (oldVal !== newVal) lines.push(`• **${k}**: ${fmt(k, oldVal, type)} → ${fmt(k, newVal, type)}`);
			}
		} else {
			lines.push(`• **${c.key}**: ${fmt(c.key, c.old, type)} → ${fmt(c.key, c.new, type)}`);
		}
	}

	return lines.join("\n") || "Sin detalles";
}

// Selector de color por clave
export function getColor(key: string): string {
	switch (key) {
		case "$add":
			return ANSI_COLOR.GREEN;
		case "$remove":
		case "communication_disabled_until":
		case "deaf":
		case "mute":
			return ANSI_COLOR.ORANGE;
		default:
			return ANSI_COLOR.BLUE;
	}
}

export function diffConsole(changes: GuildAuditLogsEntry["changes"] | undefined, type: GuildAuditLogsEntry["targetType"]): string {
	if (!changes?.length) return "Sin detalles";
	return changes
		.map((c, i) => {
			const isLast = i === changes.length - 1;
			const bullet = isLast ? "└" : "├";
			const color = getColor(c.key);
			return `${ANSI_COLOR.GRAY}${bullet}${ANSI_COLOR.RESET} ${color}${c.key}${ANSI_COLOR.RESET}: ${fmt(c.key, c.old, type)} → ${fmt(
				c.key,
				c.new,
				type
			)}`;
		})
		.join("\n");
}

