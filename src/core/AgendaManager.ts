import { Agenda } from "agenda";
import { ExtendedClient } from "../client.js";

/**
 * AgendaManager - Utilidad para inicializar y gestionar Agenda
 * Se inicializa antes de los servicios para que estos puedan usarlo
 */
export class AgendaManager {
	private static instance: Agenda | null = null;
	private static client: ExtendedClient | null = null;

	/**
	 * Inicializa Agenda y lo asigna al cliente
	 */
	static async initialize(client?: ExtendedClient): Promise<void> {
		if (client) {
			this.client = client;
		}

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

		// Definir jobs solo si tenemos el cliente
		if (this.client) {
			this.defineJobs();
		}

		// Iniciar el procesamiento de Agenda
		await this.instance.start();
		console.log("✅ Agenda inicializado correctamente");
	}

	/**
	 * Define los jobs de actualización de datos del cliente
	 */
	private static defineJobs(): void {
		if (!this.instance || !this.client) return;

		const client = this.client;

		// Define el trabajo para actualización diaria de datos del cliente
		this.instance.define("daily update client data", async () => {
			await client.updateClientData().catch((error) => {
				ExtendedClient.logError("Error en daily update client data: " + error.message, error.stack);
			});
		});

		// Define el trabajo para actualización mensual de datos del cliente
		this.instance.define("monthly update client data", async () => {
			await client.updateMonthlyClientData().catch((error) => {
				ExtendedClient.logError("Error en monthly update client data: " + error.message, error.stack);
			});
		});
	}

	/**
	 * Programa los jobs de actualización de datos del cliente
	 */
	static async scheduleClientDataJobs(): Promise<void> {
		if (!this.instance) {
			throw new Error("Agenda no ha sido inicializado. Llama a AgendaManager.initialize() primero.");
		}

		// Programar daily update client data
		const [existingDailyJob] = await this.instance.jobs({ name: "daily update client data" });
		if (!existingDailyJob) {
			await this.instance.every("0 0 * * *", "daily update client data", undefined, {
				skipImmediate: true,
				timezone: "UTC",
			});
			console.log('Trabajo "daily update client data" programado.');
		} else {
			console.log('Trabajo "daily update client data" ya está programado.');
		}

		// Programar monthly update client data (se ejecuta el primer día de cada mes a las 00:00 UTC)
		const [existingMonthlyJob] = await this.instance.jobs({ name: "monthly update client data" });
		if (!existingMonthlyJob) {
			await this.instance.every("0 0 1 * *", "monthly update client data", undefined, {
				skipImmediate: true,
				timezone: "UTC",
			});
			console.log('Trabajo "monthly update client data" programado.');
		} else {
			console.log('Trabajo "monthly update client data" ya está programado.');
		}
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

