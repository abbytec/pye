import { Events, Message } from "discord.js";
import { ExtendedClient } from "../../client.ts";

const PREFIX = "h!"; // Define tu prefijo

export default {
	name: Events.MessageCreate,
	async execute(message: Message) {
		// Evita mensajes de bots o mensajes que no tengan el prefijo
		if (message.author.bot || message.author.system || !message.content.startsWith(PREFIX)) return;

		const commandBody = message.content.slice(PREFIX.length).trim();
		const commandName = commandBody.split(/ +/, 1).shift()?.toLowerCase() ?? "";
		const commandArg = commandBody.slice(commandName.length).trim();

		// Verifica si el comando existe en la colección de comandos
		const command = (message.client as ExtendedClient).commands.get(commandName);

		if (!command) {
			message.reply("Ese comando no existe.");
			return;
		}

		// Ejecuta el comando con prefijo
		try {
			if (command.executePrefix) {
				await command.executePrefix(message, commandArg);
			} else {
				message.reply("Este comando no soporta prefijos.");
			}
		} catch (error) {
			console.error(`Error ejecutando el comando ${commandName}:`, error);
			message.reply("Hubo un error ejecutando ese comando.");
		}
	},
};
