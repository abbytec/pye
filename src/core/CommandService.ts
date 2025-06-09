import { Command } from "../types/command.js";
import { PrefixChatInputCommand } from "../utils/messages/chatInputCommandConverter.js";
import { ICooldown } from "../Models/Cooldown.js";
import { ICommandLimits, CommandLimits } from "../Models/Command.js";
import { Rob } from "../commands/farming/rob.js";
import { CoreClient } from "./CoreClient.js";

export class CommandService {
	public static readonly commands = new Map<string, Command>();
	public static readonly prefixCommands = new Map<string, PrefixChatInputCommand>();
	public readonly cooldowns = new Map<string, ICooldown>();
	private static _lastRobs: Rob[] = new Array();
	private static readonly commandLimits = new Map<string, ICommandLimits>();

	constructor(private readonly client: CoreClient) {}

	public static getCommandLimit(name: string) {
		return CommandService.commandLimits.get(name);
	}

	public static setCommandLimit(limit: ICommandLimits) {
		CommandService.commandLimits.set(limit.name, limit);
	}

	/* carga inicial */
	async loadLimits() {
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
}
