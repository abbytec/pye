import { AuditLogEvent, Guild, GuildAuditLogsEntry } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { diff } from "./utils.js";
import { AuditLogHandlers } from "../../types/auditlogs.js";

export const integrationHandlers: AuditLogHandlers = {
	[AuditLogEvent.IntegrationCreate]: async (entry: GuildAuditLogsEntry<AuditLogEvent.IntegrationCreate>, guild: Guild) => {
		const integrationId = entry.targetId ?? "";
		let msg: string;

		try {
			// requiere el intent GuildIntegrations
			const integration = (await guild.fetchIntegrations()).get(integrationId);
			if (!integration) return;

			msg =
				`Integración creada: **${integration.name}** (${integration.type})\n` +
				`• Aplicación: ${integration.application?.name ?? "—"}\n` +
				`• Cuenta: ${integration.account?.name ?? "—"}\n` +
				`• Rol gestionado: ${integration.role?.name ?? "—"}\n` +
				`• Subscriptores: ${integration.subscriberCount ?? "—"}\n` +
				`• Sync: ${integration.syncing ? "activo" : "inactivo"}\n` +
				`• Expira en: ${integration.expireGracePeriod ?? "—"} días`;
		} catch {
			// si ya fue borrada o falta intent, usa los cambios mínimos
			msg = `Integración creada (ID ${integrationId}). Cambios: ${diff(entry.changes, entry.targetType)}`;
		}

		ExtendedClient.auditLog(msg, "info", entry.executor?.username ?? undefined);
	},

	[AuditLogEvent.IntegrationDelete]: async (entry: GuildAuditLogsEntry<AuditLogEvent.IntegrationDelete>, guild: Guild) => {
		ExtendedClient.auditLog(
			`Integración eliminada (ID ${entry.targetId}). Cambios: ${diff(entry.changes, entry.targetType)}`,
			"error",
			entry.executor?.username ?? undefined
		);
	},
};

