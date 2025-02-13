// src/interfaces/ILookingForGame.ts

export interface IGameSession {
	juego: string;
	creador: string;
	descripcion: string;
	expiresAt: Date;
	limitantes?: string;
}
