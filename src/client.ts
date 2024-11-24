// src/Client.ts
import { ChannelType, Client, GatewayIntentBits, Partials, VoiceChannel } from "discord.js";
import { Command } from "./types/command.ts"; // Asegúrate de definir la interfaz Command
import { ICooldown } from "./Models/Cooldown.ts";
import { Rob } from "./commands/farming/rob.ts";
import { CommandLimits, ICommandLimits } from "./Models/Command.ts";
import { IMoney, Money } from "./Models/Money.ts";
import { Agenda } from "agenda";
import { getChannelFromEnv, getRoleFromEnv } from "./utils/constants.ts";
import Trending from "./Models/Trending.ts";

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

	private static agendaElement: Agenda;
	private _staffMembers: string[] = [];
	private _modMembers: string[] = [];
	public static readonly newUsers: Set<string> = new Set();
	public static readonly ultimosCompartePosts: Map<string, CompartePost[]> = new Map();
	public static readonly trending: Trending = new Trending();

	constructor() {
		super({
			intents: [
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildInvites,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildModeration,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.GuildPresences,
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
		const guild = this.guilds.cache.get(process.env.GUILD_ID ?? "") ?? (await this.guilds.fetch(process.env.GUILD_ID ?? ""));
		this._staffMembers =
			(await guild?.members.fetch())
				?.filter((member) => member.roles.cache.some((role) => [getRoleFromEnv("staff")].includes(role.id)))
				.map((member) => member.user.id) || this._staffMembers;

		this._modMembers =
			(await guild?.members.fetch())
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
			const voiceChannels = guild.channels.cache.filter((channel) => channel.isVoiceBased());
			voiceChannels.forEach((channel) => {
				const voiceChannel = channel as VoiceChannel;
				const members = voiceChannel.members.filter((member) => !member.user.bot).map((member) => member);
				if (members.length > 0) {
					members.forEach((member) => {
						this.voiceFarmers.set(member.id, { date: new Date(), count: 0 });
					});
				}
			});
			console.log("loading emojis");
			let emojis = (await guild.emojis.fetch()).map((emoji) => emoji.name + ":" + emoji.id);
			console.log("loading stickers");
			let stickers = (await guild.stickers.fetch()).map((sticker) => sticker.id);
			console.log("loading channels");
			let forumChannels = (await guild.channels.fetch())
				.filter((channel) => {
					return channel?.type === ChannelType.GuildForum && channel?.parent?.id === getChannelFromEnv("categoryForos");
				})
				.filter((channel) => channel != null)
				.map((channel) => channel.id);
			ExtendedClient.trending.load(emojis, stickers, forumChannels);
		} else {
			ExtendedClient.trending.dailySave();
		}
	}

	private limpiarCompartePosts(): void {
		const now = new Date();
		for (const [clave, listaPosts] of ExtendedClient.ultimosCompartePosts.entries()) {
			const postsFiltrados = listaPosts.filter((post) => now.getTime() - post.date.getTime() <= sieteDiasEnMs);
			if (postsFiltrados.length > 0) {
				ExtendedClient.ultimosCompartePosts.set(clave, postsFiltrados);
			} else {
				ExtendedClient.ultimosCompartePosts.delete(clave);
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
		if (!ExtendedClient.ultimosCompartePosts.has(userId)) ExtendedClient.ultimosCompartePosts.set(userId, []);
		ExtendedClient.ultimosCompartePosts.get(userId)?.push({ channelId, messageId, date: new Date() });
	}
}
