import { CoreClient } from "./core/CoreClient.js";
import { CommandService } from "./core/CommandService.js";
import { EconomyService } from "./core/EconomyService.js";
import { PetService } from "./core/PetService.js";
import { TrendingService } from "./core/TrendingService.js";
import { NewsService } from "./core/NewsService.js";
import { getChannelFromEnv, getRoleFromEnv } from "./utils/constants.js";
import { Guild, GuildManager, MessageFlags, TextChannel, VoiceChannel } from "discord.js";
import { inspect } from "util";
import { AIUsageControlService } from "./core/AIUsageControlService.js";
import { ForumPostControlService } from "./core/ForumPostControlService.js";
import {} from "../globals.js";
import { IGameSession } from "./interfaces/IGameSession.js";
import { Agenda } from "agenda";
import { AutoRoleService } from "./core/AutoRoleService.js";

export class ExtendedClient extends CoreClient {
	private static agendaElement: Agenda;

	public static readonly openTickets: Set<string> = new Set();
	public static readonly newUsers: Set<string> = new Set();
	public static readonly lookingForGame: Map<string, IGameSession> = new Map();

	readonly commands = new CommandService(this);
	readonly economy = new EconomyService(this);
	readonly pets = new PetService(this);
	readonly trending = new TrendingService(this);
	readonly news = new NewsService(this);
	readonly aiUsage = new AIUsageControlService(this);
	readonly forumPostControl = new ForumPostControlService(this);
	readonly autoRole = new AutoRoleService(this);

	private _staffMembers: string[] = [];
	private _modMembers: string[] = [];

	public static guildManager: GuildManager | undefined;

	constructor() {
		super();
		ExtendedClient.guildManager = this.guilds;
	}

	async updateClientData(firstTime = false) {
		const guild =
			this.guilds.cache.get(process.env.GUILD_ID ?? "") ??
			((await this.guilds.fetch(process.env.GUILD_ID ?? "").catch(() => undefined)) as Guild);
		this._staffMembers =
			(await guild?.members.fetch().catch(() => undefined))
				?.filter((member) => member.roles.cache.some((role) => [getRoleFromEnv("staff")].includes(role.id)))
				.map((member) => member.user.id) || this._staffMembers;

		this._modMembers =
			(await guild?.members.fetch().catch(() => undefined))
				?.filter((member) => member.roles.cache.some((role) => [getRoleFromEnv("moderadorChats")].includes(role.id)))
				.map((member) => member.user.id) || this._modMembers;

		this.forumPostControl.limpiarCompartePosts();
		if (firstTime) {
			await this.commands.loadLimits();
			await this.economy.loadMoneyConfigs();
			await this.trending.loadGuildData();
			this.pets.startIntervals();
			await this.forumPostControl.loadCompartePosts();
			if (process.env.NODE_ENV !== "development") {
				globalErrorHandlerInitializer();
				await AutoRoleService.updateAdaLovelace();
			}
			this.economy.voiceChannelRead(guild);
			await this.aiUsage.loadDailyUsage();
		} else {
			await this.trending.dailySave();
			await this.forumPostControl.saveCompartePosts();
			this.aiUsage.resetDaily();
			await this.trending.starboardMemeOfTheDay().catch((error) => console.error(error));
			await this.news.sendDailyNews(guild?.channels.resolve(getChannelFromEnv("chatProgramadores")) as TextChannel);
		}
		await this.economy.refreshBankAverage();
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
		let textChannel = ExtendedClient.guildManager?.cache
			.get(process.env.GUILD_ID ?? "")
			?.channels.resolve(getChannelFromEnv("logs")) as TextChannel;
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
}

function globalErrorHandlerInitializer() {
	process.on("unhandledRejection", (reason, promise) => {
		console.error("Unhandled Rejection at:", promise, "reason:", reason);
		(ExtendedClient.guildManager?.cache.get(process.env.GUILD_ID ?? "")?.channels.resolve(getChannelFromEnv("logs")) as TextChannel).send({
			content: `${
				process.env.NODE_ENV === "development" ? `@here` : "<@220683580467052544>"
			}Error en promesa no capturado, razon: ${reason}. Promesa: \`\`\`js\n${inspect(promise)}\`\`\``,
			flags: MessageFlags.SuppressNotifications,
		});
	});

	// Manejar excepciones no capturadas
	process.on("uncaughtException", (error) => {
		console.error("Uncaught Exception:", error);
		(ExtendedClient.guildManager?.cache.get(process.env.GUILD_ID ?? "")?.channels.resolve(getChannelFromEnv("logs")) as TextChannel).send({
			content: `${process.env.NODE_ENV === "development" ? `@here` : "<@220683580467052544>"}Error no capturado (${
				error.message
			}):\n \`\`\`js\n${error.stack}\`\`\``,
			flags: MessageFlags.SuppressNotifications,
		});
	});
}
