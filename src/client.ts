// src/Client.ts
import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";
import { Command } from "./types/command.ts"; // Asegúrate de definir la interfaz Command
import { ICooldown } from "./Models/Cooldown.ts";
import { Rob } from "./commands/farming/rob.ts";
import { CommandLimits, ICommandLimits } from "./Models/Command.ts";
import { IMoney, Money } from "./Models/Money.ts";
import { Agenda } from "agenda";
import { getRoleFromEnv } from "./utils/constants.ts";
import client from "./redis.ts";

interface VoiceFarming {
	date: Date;
	count: number;
}

interface CompartePost {
	date: Date;
	messageId: string;
	channelId: string;
}
const sieteDiasEnMs = 7 * 24 * 60 * 60 * 1000; // 7 días en milisegundos
export class ExtendedClient extends Client {
	public commands: Map<string, Command>;
	private readonly _commandLimits: Map<string, ICommandLimits>;
	private readonly moneyConfigs: Map<string, IMoney>;
	public cooldowns: Map<string, ICooldown>;
	public lastRobs: Rob[];
	public voiceFarmers: Map<string, VoiceFarming>;
	public newUsers: Set<string>;
	private static agendaElement: Agenda;
	private _staffMembers: string[] = [];
	private _modMembers: string[] = [];
	public ultimosCompartePosts: Map<string, CompartePost[]> = new Map();

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

	public static set agenda(agenda: Agenda) {
		this.agendaElement = agenda;
	}

	public static get agenda() {
		return this.agendaElement;
	}

	public getCommandLimit(commandName: string) {
		return this._commandLimits.get(commandName);
	}

	public setCommandLimit(command: ICommandLimits) {
		this._commandLimits.set(command.name, command);
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

	public async updateClientData(firstTime: boolean = false) {
		this._staffMembers =
			(await this.guilds.cache.get(process.env.GUILD_ID ?? "")?.members.fetch())
				?.filter((member) => member.roles.cache.some((role) => [getRoleFromEnv("staff")].includes(role.id)))
				.map((member) => member.user.id) || this._staffMembers;

		this._modMembers =
			(await this.guilds.cache.get(process.env.GUILD_ID ?? "")?.members.fetch())
				?.filter((member) => member.roles.cache.some((role) => [getRoleFromEnv("moderadorChats")].includes(role.id)))
				.map((member) => member.user.id) || this._modMembers;

		this.limpiarCompartePosts();

		if (firstTime) {
			await CommandLimits.find().then((res: ICommandLimits[]) => {
				res.forEach((command) => {
					this.setCommandLimit(command);
				});
			});
			await Money.find().then((res: IMoney[]) => {
				res.forEach((money) => {
					this.moneyConfigs.set(money._id, money);
				});
			});
			// TODO: chequear users en el voice
		}
	}

	private limpiarCompartePosts(): void {
		const now = new Date();
		for (const [clave, listaPosts] of this.ultimosCompartePosts.entries()) {
			const postsFiltrados = listaPosts.filter((post) => now.getTime() - post.date.getTime() <= sieteDiasEnMs);
			if (postsFiltrados.length > 0) {
				this.ultimosCompartePosts.set(clave, postsFiltrados);
			} else {
				this.ultimosCompartePosts.delete(clave);
			}
		}
	}

	public get staffMembers() {
		return this._staffMembers;
	}

	public get modMembers() {
		return this._modMembers;
	}

	public agregarCompartePost(userId: string, channelId: string, messageId: string) {
		if (!this.ultimosCompartePosts.has(userId)) this.ultimosCompartePosts.set(userId, []);
		this.ultimosCompartePosts.get(userId)?.push({ channelId, messageId, date: new Date() });
	}
}
