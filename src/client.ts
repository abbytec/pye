import { CoreClient } from "./core/CoreClient.js";
import { CommandService } from "./core/services/CommandService.js";
import { EconomyService } from "./core/services/EconomyService.js";
import { PetService } from "./core/services/PetService.js";
import { TrendingService } from "./core/services/TrendingService.js";
import { NewsService } from "./core/services/NewsService.js";
import { getChannelFromEnv, getRoleFromEnv } from "./utils/constants.js";
import { Guild, GuildManager, MessageFlags, TextChannel } from "discord.js";
import { AIUsageControlService } from "./core/services/AIUsageControlService.js";
import { ForumPostControlService } from "./core/services/ForumPostControlService.js";
import {} from "../globals.js";
import { IGameSession } from "./interfaces/IGameSession.js";
import { Agenda } from "agenda";
import { AutoRoleService } from "./core/services/AutoRoleService.js";
import { inspect } from "util";

export class ExtendedClient extends CoreClient {
	private static agendaElement: Agenda;

	public static readonly openTickets: Set<string> = new Set();
	public static readonly newUsers: Set<string> = new Set();
	public static readonly lookingForGame: Map<string, IGameSession> = new Map();

	public static guild: Guild | undefined;

	readonly commands;
	readonly economy;
	readonly pets;
	readonly trending;
	readonly news;
	readonly aiUsage;
	readonly forumPostControl;
	readonly autoRole;

	private _staffMembers: string[] = [];
	private _modMembers: string[] = [];

	constructor() {
		super();
		this.commands = new CommandService(this);
		this.economy = new EconomyService(this);
		this.pets = new PetService(this);
		this.trending = new TrendingService(this);
		this.news = new NewsService(this);
		this.aiUsage = new AIUsageControlService(this);
		this.forumPostControl = new ForumPostControlService(this);
		this.autoRole = new AutoRoleService(this);
	}

	async updateClientData(firstTime = false) {
		ExtendedClient.guild = this.guilds.cache.get(process.env.GUILD_ID ?? "") ?? (this.guilds.resolve(process.env.GUILD_ID ?? "") as Guild);

		this._staffMembers =
			(await ExtendedClient.guild?.members.fetch().catch(() => undefined))
				?.filter((member) => member.roles.cache.some((role) => [getRoleFromEnv("staff")].includes(role.id)))
				.map((member) => member.user.id) || this._staffMembers;

		this._modMembers =
			(await ExtendedClient.guild?.members.fetch().catch(() => undefined))
				?.filter((member) => member.roles.cache.some((role) => [getRoleFromEnv("moderadorChats")].includes(role.id)))
				.map((member) => member.user.id) || this._modMembers;
		if (firstTime) {
			if (process.env.NODE_ENV !== "development") {
				this.globalErrorHandlerInitializer();
			}
			await this.commands.start();
			await this.economy.start();
			await this.trending.start();
			this.pets.start();
			await this.forumPostControl.start();
			await this.autoRole.start();
			await this.aiUsage.start();
		} else {
			await this.trending.dailyRepeat();
			await this.forumPostControl.dailyRepeat();
			this.aiUsage.dailyRepeat();
			await this.news.dailyRepeat();
			await this.economy.dailyRepeat();
		}
	}

	public get staffMembers() {
		return this._staffMembers;
	}

	public get modMembers() {
		return this._modMembers;
	}

	public static set agenda(agenda: Agenda) {
		this.agendaElement = agenda;
	}

	public static get agenda() {
		return this.agendaElement;
	}
	public static logError(errorMessage: string, stackTrace?: string, userId?: string) {
		let textChannel = ExtendedClient.guild?.channels.resolve(getChannelFromEnv("logs")) as TextChannel;
		let content = "Log de error. ";
		if (userId) content += "Usuario: <@" + (userId ?? "desconocido") + ">\n";
		content += errorMessage;
		if (stackTrace) {
			content += `\n\n\`\`\`js\n${stackTrace}\`\`\``;
		}
		textChannel
			?.send({
				content,
				flags: MessageFlags.SuppressNotifications,
			})
			.catch((e) => console.error(e))
			.finally(() => {
				console.error(errorMessage);
			});
	}
	private globalErrorHandlerInitializer() {
		process.on("unhandledRejection", (reason, promise) => {
			console.error("Unhandled Rejection at:", promise, "reason:", reason);
			(ExtendedClient.guild?.channels.resolve(getChannelFromEnv("logs")) as TextChannel).send({
				content: `${
					process.env.NODE_ENV === "development" ? `@here` : "<@220683580467052544>"
				}Error en promesa no capturado, razon: ${reason}. Promesa: \`\`\`js\n${inspect(promise)}\`\`\``,
				flags: MessageFlags.SuppressNotifications,
			});
		});

		// Manejar excepciones no capturadas
		process.on("uncaughtException", (error) => {
			console.error("Uncaught Exception:", error);
			(ExtendedClient.guild?.channels.resolve(getChannelFromEnv("logs")) as TextChannel).send({
				content: `${process.env.NODE_ENV === "development" ? `@here` : "<@220683580467052544>"}Error no capturado (${
					error.message
				}):\n \`\`\`js\n${error.stack}\`\`\``,
				flags: MessageFlags.SuppressNotifications,
			});
		});
	}
}
