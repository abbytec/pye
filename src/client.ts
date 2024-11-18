// src/Client.ts
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { Command } from "./types/command.ts"; // Asegúrate de definir la interfaz Command
import { ICooldown } from "./Models/Cooldown.ts";
import { Rob } from "./commands/farming/rob.ts";
import { ICommandLimits } from "./Models/Command.ts";
import { IMoney } from "./Models/Money.ts";

interface VoiceFarming {
	date: Date;
	count: number;
}

export class ExtendedClient extends Client {
	public commands: Map<string, Command>;
	private readonly _commandLimits: Map<string, ICommandLimits>;
	private readonly moneyConfigs: Map<string, IMoney>;
	public cooldowns: Map<string, ICooldown>;
	public lastRobs: Rob[];
	public voiceFarmers: Map<string, VoiceFarming>;
	public newUsers: Set<string>;

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

			partials: [Partials.GuildMember, Partials.Channel, Partials.Reaction, Partials.Message, Partials.ThreadMember, Partials.User],
		});

		this.commands = new Map();
		this.cooldowns = new Map();
		this.lastRobs = [];
		this._commandLimits = new Map();
		this.moneyConfigs = new Map();
		this.voiceFarmers = new Map();
		this.newUsers = new Set();
	}

	public getCommandLimit(commandName: string) {
		return this._commandLimits.get(commandName);
	}

	public setCommandLimit(command: ICommandLimits) {
		this._commandLimits.set(command.name, command);
	}

	public setMoneyConfig(moneyConfig: IMoney) {
		this.moneyConfigs.set(moneyConfig._id, moneyConfig);
	}

	public getMoneyConfig(guildId: string) {
		return (
			this.moneyConfigs.get(guildId) ?? {
				_id: process.env.CLIENT_ID ?? "",
				bump: 0,
				voice: {
					time: 60000,
					coins: 100,
				},
				text: {
					time: 3000,
					coins: 10,
				},
			}
		);
	}
}
