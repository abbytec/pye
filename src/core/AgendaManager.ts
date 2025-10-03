import { Agenda } from "agenda";
import { ExtendedClient } from "../client.js";

/**
 * AgendaManager - Utilidad para inicializar y gestionar Agenda
 * Se inicializa antes de los servicios para que estos puedan usarlo
 */
export class AgendaManager {
	private static instance: Agenda | null = null;

	/**
	 * Inicializa Agenda y lo asigna al cliente
	 */
	static async initialize(): Promise<void> {
		this.instance = new Agenda(
			{
				db: { address: process.env.MONGO_URI ?? "", collection: "agenda_jobs" },
				processEvery: "1 minute",
			},
			(error) => {
				if (error) {
					ExtendedClient.logError("Error al inicializar Agenda: " + error.message);
				}
			}
		);

		this.instance.on("error", (error) => {
			console.error("Error en Agenda:", error);
			ExtendedClient.logError("Error en Agenda: " + error.message, error.stack);
		});

		// Iniciar el procesamiento de Agenda
		await this.instance.start();
		console.log("✅ Agenda inicializado correctamente");
	}

	/**
	 * Detiene Agenda
	 */
	static async stop(): Promise<void> {
		if (this.instance) {
			await this.instance.stop();
			console.log("Agenda detenido");
			this.instance = null;
		}
	}

	/**
	 * Obtiene la instancia de Agenda
	 */
	static getInstance(): Agenda {
		if (!this.instance) {
			throw new Error("Agenda no ha sido inicializado. Llama a AgendaManager.initialize() primero.");
		}
		return this.instance;
	}
}

