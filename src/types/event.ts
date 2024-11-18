import { ExtendedClient } from "../client.ts";

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
