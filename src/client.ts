// src/Client.ts
import { Client, Collection, GatewayIntentBits } from "discord.js";
import { Command } from "./types/command.ts"; // Asegúrate de definir la interfaz Command

export class ExtendedClient extends Client {
	public commands: Collection<string, Command>;
	public cooldowns: Collection<string, number>;

	constructor() {
		super({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildPresences,
				GatewayIntentBits.GuildModeration,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
			],
		});

		this.commands = new Collection();
		this.cooldowns = new Collection();
	}
}
