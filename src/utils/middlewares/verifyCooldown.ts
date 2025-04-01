// src/utils/middlewares/verifyCooldown.ts

import { Middleware } from "../../types/middleware.js";
import { getCooldown, setCooldown } from "../../utils/cooldowns.js";
import { formatTime } from "../generic.js";
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
	adjustCooldownDuration?: (interaction: IPrefixChatInputCommand) => Promise<number> | number,
	autoSetter: boolean = true,
	customUID?: string
): Middleware => {
	return async (interaction, next) => {
		const userId = customUID ?? interaction.user.id;

		// Ajustar la duración del cooldown si se proporciona una función para ello
		let finalCooldownDuration = cooldownDuration;
		if (adjustCooldownDuration) {
			finalCooldownDuration = await adjustCooldownDuration(interaction);
		}
		// Obtener el tiempo restante de cooldown
		const remainingCooldown = await getCooldown(interaction.client, userId, commandName, finalCooldownDuration);

		if (remainingCooldown > 0) {
			const timeLeft = formatTime(remainingCooldown);
			let message = await interaction.reply({
				content: `❌ - Debes esperar **${
					timeLeft ?? (remainingCooldown / 1000).toFixed(2) + "segundos"
				}** antes de usar el comando **${commandName}** de nuevo.`,
				ephemeral: true,
			});

			setTimeout(async () => {
				await message.delete().catch(() => null);
			}, 8000);
			return; // Detiene la cadena de middlewares
		}

		if (autoSetter) {
			await setCooldown(interaction.client, userId, commandName, finalCooldownDuration);
		}

		// Continúa al siguiente middleware o al manejador de comandos
		await next();
	};
};
