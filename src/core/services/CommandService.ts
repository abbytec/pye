import { Command } from "../../types/command.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { ICooldown } from "../../Models/Cooldown.js";
import { ICommandLimits, CommandLimits } from "../../Models/Command.js";
import { Rob } from "../../commands/farming/rob.js";
import { CoreClient } from "../CoreClient.js";
import { IService } from "../IService.js";
import { Message } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { ParameterError } from "../../interfaces/IPrefixChatInputCommand.js";
import { PREFIX } from "../../utils/constants.js";

export default class CommandService implements IService {
	public readonly serviceName = "commands";
	public static readonly commands = new Map<string, Command>();
	public static readonly prefixCommands = new Map<string, PrefixChatInputCommand>();
	public readonly cooldowns = new Map<string, ICooldown>();
	private static _lastRobs: Rob[] = [];
	private static readonly commandLimits = new Map<string, ICommandLimits>();

	constructor(private readonly client: CoreClient) {}

	public static getCommandLimit(name: string) {
		return CommandService.commandLimits.get(name);
	}

	public static setCommandLimit(limit: ICommandLimits) {
		CommandService.commandLimits.set(limit.name, limit);
	}

	/* carga inicial */
	async start() {
		console.log("loading commands limits");
		const limits = await CommandLimits.find().catch(() => []);
		limits.forEach((l) => CommandService.commandLimits.set(l.name, l));
	}

	public static get lastRobs() {
		return CommandService._lastRobs;
	}
	public static set lastRobs(robs: Rob[]) {
		CommandService._lastRobs = robs;
	}

	public async processPrefixCommand(message: Message) {
		const commandBody = message.content.slice(PREFIX.length).trim();
		const commandName = commandBody.split(/ +/, 1).shift()?.toLowerCase() ?? "";

		// Verifica si el comando existe en la colección de comandos
		const command = CommandService.prefixCommands.get(commandName);

		if (!command) {
			message.reply("Ese comando no existe, quizá se actualizó a Slash Command :point_right: /.\n Prueba escribiendo /help.");
			return;
		}

		try {
			const parsedMessage = await command.parseMessage(message);
			if (parsedMessage) {
				const commandFunction = CommandService.commands.get(command.commandName);
				if (commandFunction) {
					commandFunction.execute(parsedMessage);
				} else {
					ExtendedClient.logError("Comando no encontrado: " + command.commandName, undefined, message.author.id);
				}
			} else {
				message.reply({ content: "Hubo un error ejecutando ese comando.", ephemeral: true } as any).catch(() => null);
			}
		} catch (error: any) {
			if (!(error instanceof ParameterError)) {
				console.error(`Error ejecutando el comando ${commandName}:`, error);
			}
			message.reply({ content: "Hubo un error ejecutando ese comando.\n" + error.message, ephemeral: true } as any).catch(() => null);
		}
	}
}
