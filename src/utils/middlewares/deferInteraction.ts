// middlewares/deferInteraction.ts
import { Middleware } from "../../types/middleware.ts";

export const deferInteraction: Middleware = async (interaction, next) => {
	// Verifica si la interacción ya ha sido respondida
	if (!interaction.deferred && !interaction.replied) {
		await interaction.deferReply({ ephemeral: true }); // Puedes ajustar las opciones según tus necesidades
	}
	await next();
};
