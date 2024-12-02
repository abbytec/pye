// src/Client.ts
import { ChannelType, Client, GatewayIntentBits, Partials, TextChannel, VoiceChannel } from "discord.js";
import { Command } from "./types/command.js"; // Asegúrate de definir la interfaz Command
import { ICooldown } from "./Models/Cooldown.js";
import { Rob } from "./commands/farming/rob.js";
import { CommandLimits, ICommandLimits } from "./Models/Command.js";
import { IMoney, Money } from "./Models/Money.js";
import { Agenda } from "agenda";
import { getChannelFromEnv, getRoleFromEnv } from "./utils/constants.js";
import Trending from "./Models/Trending.js";
import { ICompartePost, ICompartePostModel, UltimosCompartePosts } from "./Models/CompartePostModel.js";
import { AnyBulkWriteOperation } from "mongoose";

interface VoiceFarming {
	date: Date;
	count: number;
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
	public static readonly ultimosCompartePosts: Map<string, ICompartePost[]> = new Map();
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

	// Funcion llamada diariamente, firstTime es para que se ejecute cuando se corre el bot por primera vez
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
			process.on("unhandledRejection", (reason, promise) => {
				console.error("Unhandled Rejection at:", promise, "reason:", reason);
				(this.guilds.cache.get(process.env.GUILD_ID ?? "")?.channels.resolve(getChannelFromEnv("logs")) as TextChannel).send({
					content: `${
						process.env.NODE_ENV === "development" ? `@here` : "<@220683580467052544> <@1088883078405038151> <@602240617862660096>"
					}Error en promesa no capturado, razon: ${reason}`,
				});
			});

			// Manejar excepciones no capturadas
			process.on("uncaughtException", (error) => {
				console.error("Uncaught Exception:", error);
				(this.guilds.cache.get(process.env.GUILD_ID ?? "")?.channels.resolve(getChannelFromEnv("logs")) as TextChannel).send({
					content: `${
						process.env.NODE_ENV === "development" ? `@here` : "<@220683580467052544> <@1088883078405038151> <@602240617862660096>"
					}Error no capturado (${error.message}):\n \`\`\`js\n${error.stack}\`\`\``,
				});
			});
			console.log("loading latest CompartePosts");
			await this.loadCompartePosts();
			console.log("loading commands");
			await CommandLimits.find()
				.then((res: ICommandLimits[]) => {
					res.forEach((command) => {
						this.setCommandLimit(command);
					});
				})
				.catch((error) => console.error(error));

			console.log("loading money configs");
			await Money.find()
				.then((res: IMoney[]) => {
					res.forEach((money) => {
						this.moneyConfigs.set(money._id, money);
					});
				})
				.catch((error) => console.error(error));
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
			await this.saveCompartePosts().catch((error) => console.error(error));
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

	public agregarCompartePost(userId: string, channelId: string, messageId: string, hash: string) {
		if (!ExtendedClient.ultimosCompartePosts.has(userId)) ExtendedClient.ultimosCompartePosts.set(userId, []);
		ExtendedClient.ultimosCompartePosts.get(userId)?.push({ channelId, messageId, date: new Date(), hash });
	}

	public async loadCompartePosts(): Promise<void> {
		try {
			const document = await UltimosCompartePosts.find().sort({ date: -1 }).exec();

			if (document) {
				document.forEach((post: ICompartePost) => {
					if (!ExtendedClient.ultimosCompartePosts.has(post.userId ?? "")) {
						ExtendedClient.ultimosCompartePosts.set(post.userId ?? "", []);
					}
					ExtendedClient.ultimosCompartePosts.get(post.userId ?? "")?.push({
						channelId: post.channelId,
						messageId: post.messageId,
						hash: post.hash,
						date: post.date,
					});
				});
				console.log("CompartePosts cargados exitosamente desde la base de datos.");
			} else {
				console.log("No se encontraron CompartePosts previos en la base de datos.");
			}
		} catch (error) {
			console.error("Error al cargar CompartePosts:", error);
		}
	}

	public async saveCompartePosts(): Promise<void> {
		try {
			const bulkOps: AnyBulkWriteOperation<ICompartePost>[] = [];

			// Operación para eliminar todos los documentos existentes
			bulkOps.push({
				deleteMany: {
					filter: {},
				},
			});

			// Operaciones para insertar nuevos documentos
			ExtendedClient.ultimosCompartePosts.forEach((posts, userId) => {
				posts.forEach((post) => {
					bulkOps.push({
						insertOne: {
							document: {
								userId,
								channelId: post.channelId,
								messageId: post.messageId,
								hash: post.hash,
								date: post.date,
							},
						},
					});
				});
			});

			// Ejecutar todas las operaciones en bulk
			await UltimosCompartePosts.bulkWrite<ICompartePost>(bulkOps);
			console.log("CompartePosts guardados exitosamente en la base de datos.");
		} catch (error) {
			console.error("Error al guardar CompartePosts:", error);
		}
	}
}
