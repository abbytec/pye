import { Middleware } from "../../types/middleware.js";

/**
 * Middleware para verificar que la interacción se realizó en un canal específico.
 * @param channelID - El ID del canal permitido.
 * @returns Un middleware que verifica el canal de la interacción.
 */
export const verifyChannel = (channelID: string): Middleware => {
	return async (interaction, next) => {
		const channel = interaction.channel;

		// Verifica si la interacción tiene un canal y si el ID coincide
		if (!channel || channel.id !== channelID) {
			await interaction.reply({
				content: "❌ - Este comando solo puede usarse en el canal designado.",
				ephemeral: true,
			});
			return; // Detiene la cadena de middlewares
		}

		// Continúa al siguiente middleware o al manejador de comandos
		await next();
	};
};
