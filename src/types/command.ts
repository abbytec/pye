import { ChatInputCommandInteraction, SlashCommandOptionsOnlyBuilder } from "discord.js";

/**
 * Interfaz que define la estructura de un comando.
 */
export interface Command {
	/**
	 * Datos del comando, construidos usando SlashCommandBuilder.
	 */
	data: SlashCommandOptionsOnlyBuilder;

	/**
	 * Función que se ejecuta cuando el comando es invocado.
	 * @param interaction - La interacción de comando.
	 */
	execute(interaction: ChatInputCommandInteraction): Promise<void>;
}
