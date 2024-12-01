import { ExtendedClient } from "../client.js";

export interface Evento {
	name: string;
	execute(...args: any[]): Promise<void>;
	once?: boolean;
}

export interface EventoConClienteForzado {
	name: string;
	executeWithClient(client: ExtendedClient, ...args: any[]): Promise<void>;
	once?: boolean;
}
