// src/interfaces/ILookingForGame.ts

export interface IGameSession {
	juego: string;
	creador: string;
	descripcion: string;
	participantes: string[];
	expiresAt: Date;
	limitantes?: string;
}
