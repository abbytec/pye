import { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder } from "discord.js";
import { PrefixChatInputCommand } from "../utils/messages/chatInputCommandConverter.js";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";

/**
 * Interfaz que define la estructura de un comando.
 */
export interface Command {
	/**
	 * Datos del comando, construidos usando SlashCommandBuilder.
	 */
	data: SlashCommandOptionsOnlyBuilder | SlashCommandBuilder;

	/**
	 * Función que se ejecuta cuando el comando es invocado.
	 * @param interaction - La interacción de comando.
	 */
	execute(interaction: IPrefixChatInputCommand): Promise<void>;

	prefixResolver?: PrefixChatInputCommand;

	group?: string;

	isAdmin?: boolean;
}
