import { Events, Presence, ActivityType } from "discord.js";
import { EventoConClienteForzado } from "../types/event.js";
import { ExtendedClient } from "../client.js";
import { getRoleFromEnv } from "../utils/constants.js";

export default {
	name: Events.PresenceUpdate,
	once: false,
	async executeWithClient(client: ExtendedClient, oldPresence: Presence | null, newPresence: Presence) {
		// Ignorar bots
		if (!newPresence.user || newPresence.user?.bot) return;

		// Buscar la actividad de estado custom (CUSTOM_STATUS)
		const oldCustom = oldPresence?.activities.find((activity) => activity.type === ActivityType.Custom);
		const newCustom = newPresence.activities.find((activity) => activity.type === ActivityType.Custom);

		if (newCustom == oldCustom) return;
		// Define el criterio que consideras "vanity"
		const vanityCriteria = ".gg/programacion"; // Reemplaza "tuVanity" por el texto que busques

		// Si se añadió o actualizó el custom status y contiene el vanity:
		if (newCustom?.state?.includes(vanityCriteria)) {
			// Procesar solo si previamente no tenía el vanity
			if (!oldCustom?.state?.includes(vanityCriteria) || !oldPresence?.member?.roles.cache.has(getRoleFromEnv("colaborador"))) {
				await newPresence.member?.roles.add(getRoleFromEnv("colaborador")).catch(() => null);
			}
		} else if (newPresence.member?.roles.cache.has(getRoleFromEnv("colaborador"))) {
			await newPresence.member.roles.remove(getRoleFromEnv("colaborador")).catch(() => null);
		}
	},
} as EventoConClienteForzado;
