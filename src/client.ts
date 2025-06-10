import { CoreClient } from "./core/CoreClient.js";
import { getChannelFromEnv, getRoleFromEnv } from "./utils/constants.js";
import { Guild, MessageFlags, TextChannel } from "discord.js";
import {} from "../globals.js";
import { IGameSession } from "./interfaces/IGameSession.js";
import { Agenda } from "agenda";
import { inspect } from "util";
import fs from "node:fs";
import path, { dirname } from "node:path";
import { ServiceInstanceMap, ServiceName } from "./core/services.config.js";
import { fileURLToPath, pathToFileURL } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const extension = process.env.NODE_ENV === "development" ? ".ts" : ".js";
const servicesDir = path.resolve(__dirname, "core/services");
export class ExtendedClient extends CoreClient {
	private static agendaElement: Agenda;

	public static readonly openTickets: Set<string> = new Set();
	public static readonly newUsers: Set<string> = new Set();
	public static readonly lookingForGame: Map<string, IGameSession> = new Map();

	public static guild: Guild | undefined;

	readonly services = {} as ServiceInstanceMap;

	private _staffMembers: string[] = [];
	private _modMembers: string[] = [];

	constructor() {
		super();
	}

	public async loadServices() {
		const files = fs.readdirSync(servicesDir).filter((f) => f.endsWith(extension));

		for (const file of files) {
			const url = pathToFileURL(path.join(servicesDir, file)).href;

			try {
				console.log(`Cargando servicio ${file}`);
				const mod = await import(url);
				const Ctor = mod.default ?? mod;
				if (typeof Ctor !== "function") throw new Error(`${file} no exporta una clase por default`);
				const instance = new Ctor(this);
				this.services[instance.serviceName as ServiceName] = instance;
			} catch (err) {
				ExtendedClient.logError(`Fallo cargando servicio ${file}`, (err as any).stack);
				console.error(`❌  ${file}:`, err);
			}
		}
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
		if (firstTime && process.env.NODE_ENV !== "development") {
			this.globalErrorHandlerInitializer();
		}
		for (const srv of Object.values(this.services)) {
			if (firstTime) await srv.start?.();
			else await srv.dailyRepeat?.();
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
