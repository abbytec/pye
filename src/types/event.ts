export interface Evento {
	name: string;
	execute(...args: any[]): Promise<void>;
	once?: boolean;
}
