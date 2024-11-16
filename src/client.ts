// src/Client.ts
import { Client, Collection, GatewayIntentBits } from "discord.js";
import { Command } from "./types/command.ts"; // Asegúrate de definir la interfaz Command
import { ICooldown } from "./Models/Cooldown.ts";
import { Rob } from "./commands/farming/rob.ts";
import { ICommandLimits } from "./Models/Command.ts";

export class ExtendedClient extends Client {
	public commands: Collection<string, Command>;
	private readonly _commandLimits: Collection<string, ICommandLimits>;
	public cooldowns: Map<string, ICooldown>;
	public lastRobs: Rob[];

	constructor() {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildPresences,
				GatewayIntentBits.GuildModeration,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.GuildVoiceStates,
				GatewayIntentBits.MessageContent,
			],
		});

		this.commands = new Collection();
		this.cooldowns = new Map();
		this.lastRobs = [];
		this._commandLimits = new Collection();
	}

	public getCommandLimit(commandName: string) {
		return this._commandLimits.get(commandName);
	}

	public setCommandLimit(command: ICommandLimits) {
		this._commandLimits.set(command.name, command);
	}
}
