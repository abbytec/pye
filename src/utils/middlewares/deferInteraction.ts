// middlewares/deferInteraction.ts
import { Middleware } from "../../types/middleware.js";

export const deferInteraction = (ephemeral = true): Middleware => {
	return async (interaction, next) => {
		// Verifica si la interacción ya ha sido respondida
		if (!interaction.deferred && !interaction.replied) {
			await interaction.deferReply({ ephemeral }); // Puedes ajustar las opciones según tus necesidades
		}
		await next();
	};
};
