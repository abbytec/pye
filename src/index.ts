import loadEnvVariables from "./utils/environment.js";
import fs, { readdirSync } from "node:fs";
import { GlobalFonts } from "@napi-rs/canvas";
import path, { dirname, join } from "node:path";
import { ExtendedClient } from "./client.js";
import { connect } from "mongoose";
import { Command } from "./types/command.js";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Evento, EventoConClienteForzado } from "./types/event.js";
import {} from "../globals.js";
import CommandService from "./core/services/CommandService.js";

loadEnvVariables();
const __dirname = dirname(fileURLToPath(import.meta.url));


export function registerFonts() {
	const fontsDir = path.join(__dirname, "assets/fonts");
	const exts = [".ttf", ".otf", ".ttc", ".woff", ".woff2"];

	if (!fs.existsSync(fontsDir)) {
		fs.mkdirSync(fontsDir, { recursive: true });
		console.warn(`[fonts] Carpeta creada sin fuentes: ${fontsDir}`);
		return;
	}

	for (const entry of fs.readdirSync(fontsDir, { withFileTypes: true })) {
		if (entry.isDirectory()) continue;
		const ext = path.extname(entry.name).toLowerCase();
		if (!exts.includes(ext)) continue;

		try {
			const fontName = path.basename(entry.name, ext);
			GlobalFonts.registerFromPath(path.join(fontsDir, entry.name), fontName);
		} catch (err) {
			console.warn(`[fonts] No se pudo registrar ${entry.name}:`, err);
		}
	}
}

registerFonts();

const client = new ExtendedClient();
await client.loadServices();

const extension = process.env.NODE_ENV === "development" ? ".ts" : ".js";


async function loadCommands() {
	const commandFolders = readdirSync(path.join(__dirname, "commands"));

	await Promise.allSettled(
		commandFolders.map(async (folder) => {
			const commandsPath = path.join(__dirname, "commands", folder);
			const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith(extension));

			await Promise.allSettled(
				commandFiles.map(async (file) => {
					const filePath = path.join(commandsPath, file);
					try {
						const module = await import(pathToFileURL(filePath).href);
						const command: Command = module.default || module;

						if (!command?.data) {
							console.warn(`[ADVERTENCIA] El comando en ${filePath} carece de la propiedad "data".`);
							return;
						}

						console.log(`Cargando comando: ${command.data.name}`);
						CommandService.commands.set(command.data.name, command);

						if (command.prefixResolver) {
							const instance = command.prefixResolver(client);
							command.prefixResolverInstance = instance;
							CommandService.prefixCommands.set(instance.commandName, instance);
							instance.aliases.forEach((alias) => CommandService.prefixCommands.set(alias, instance));
						}
					} catch (error) {
						console.error(`[ERROR] No se pudo cargar el comando ${filePath}:`, error);
					}
				})
			);
		})
	);

	console.log("Comandos cargados.");
}


async function loadEvents() {
	const eventsPath = join(__dirname, "events");
	const eventFiles = readdirSync(eventsPath).filter((file) => file.endsWith(extension));

	await Promise.allSettled(
		eventFiles.map(async (file) => {
			const filePath = join(eventsPath, file);
			try {
				const module = await import(pathToFileURL(filePath).href);
				const event: Evento | EventoConClienteForzado = module.default ?? module;

				if (
					!event?.name ||
					("execute" in event && typeof event.execute !== "function") ||
					("executeWithClient" in event && typeof event.executeWithClient !== "function")
				) { 
					console.warn(`[ADVERTENCIA] El evento en ${filePath} no tiene formato válido.`);
					return;
				}

				console.log(`Cargando evento: ${event.name}`);
				client[event.once ? "once" : "on"](event.name, (...args: any[]) =>
					"executeWithClient" in event ? event.executeWithClient(client, ...args) : event.execute(...args)
				);
			} catch (error) {
				console.error(`[ERROR] No se pudo cargar el evento ${filePath}:`, error);
			}
		})
	);

	console.log("Eventos cargados.");
}


async function main() {
	try {
		await connect(process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/", {
			connectTimeoutMS: 20000,
		});
		console.log("Conectado a la base de datos.");

		await Promise.all([loadCommands(), loadEvents()]);

		if (!process.env.TOKEN_BOT) throw new Error("TOKEN_BOT no definido en las variables de entorno.");
		await client.login(process.env.TOKEN_BOT);
	} catch (error: any) {
		console.error("Error en la inicialización:", error?.message || error);
	}
}

main();
