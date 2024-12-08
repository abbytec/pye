// src/utils/middlewares/verifyCooldown.ts

import { Middleware } from "../../types/middleware.js";
import { getCooldown } from "../../utils/cooldowns.js";
import { ChatInputCommandInteraction } from "discord.js";
import { formatTime } from "../generic.js";
import { ExtendedClient } from "../../client.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

/**
 * Middleware para verificar si un usuario tiene un cooldown activo para un comando específico.
 * Si el usuario está en cooldown, responde con un mensaje indicando el tiempo restante.
 * @param commandName - El nombre del comando.
 * @param cooldownDuration - La duración base del cooldown en milisegundos.
 * @param adjustCooldownDuration? - Función opcional para ajustar la duración del cooldown basada en la interacción.
 * @returns Un middleware que verifica el cooldown del usuario.
 */
export const verifyCooldown = (
	commandName: string,
	cooldownDuration: number,
	adjustCooldownDuration?: (interaction: IPrefixChatInputCommand) => Promise<number> | number
): Middleware => {
	return async (interaction, next) => {
		const userId = interaction.user.id;

		// Ajustar la duración del cooldown si se proporciona una función para ello
		let finalCooldownDuration = cooldownDuration;
		if (adjustCooldownDuration) {
			finalCooldownDuration = await adjustCooldownDuration(interaction);
		}

		// Obtener el tiempo restante de cooldown
		const remainingCooldown = await getCooldown(interaction.client, userId, commandName, finalCooldownDuration);

		if (remainingCooldown > 0) {
			const timeLeft = formatTime(remainingCooldown);
			await interaction.reply({
				content: `❌ - Debes esperar **${timeLeft}** antes de usar el comando **${commandName}** de nuevo.`,
				ephemeral: true,
			});
			return; // Detiene la cadena de middlewares
		}

		// Continúa al siguiente middleware o al manejador de comandos
		await next();
	};
};
