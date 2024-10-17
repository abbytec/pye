// middlewares/verifyIsGuild.ts
import { Middleware } from "../../types/middleware.ts";
import { CommandInteraction } from "discord.js";

/**
 * Middleware para verificar que la interacción se realizó en un guild.
 */
export const verifyIsGuild = (guildID: string): Middleware => {
	return async (interaction, next) => {
		if (!interaction.guild || interaction.guild.id !== guildID) {
			await interaction.reply({
				content: "Este comando solo puede usarse dentro del servidor de PyE.",
				ephemeral: true,
			});
			return; // No llamar a next(), detiene la cadena
		}
		await next(); // Continua al siguiente middleware
	};
};
