import loadEnvVariables from "./utils/environment.ts";
import { readdirSync } from "node:fs";
import path, { dirname, join } from "node:path";
import { ExtendedClient } from "./client.ts";
import { connect } from "mongoose";
import { Command } from "./types/command.ts";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new ExtendedClient();
const extension = process.env.NODE_ENV === "development" ? ".ts" : ".js";

const loadCommands = async () => {
	const commandFolders = readdirSync(path.join(__dirname, "commands"));
	const importPromises = commandFolders.map(async (folder) => {
		const commandsPath = path.join(__dirname, "commands", folder);
		const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith(extension));

		const commandsImportPromises = commandFiles.map(async (file) => {
			const filePath = path.join(commandsPath, file);
			try {
				const commandModule = await import(pathToFileURL(filePath).href);
				const command: Command = commandModule.default || commandModule;

				if (command.data) {
					console.log(`Cargando comando: ${command.data.name}`);
					client.commands.set(command.data.name, command);
				} else {
					console.log(`[ADVERTENCIA] El comando en ${filePath} carece de la propiedad "data".`);
				}
			} catch (error) {
				console.error(`Error al cargar el comando ${filePath}:`, error);
			}
		});

		await Promise.all(commandsImportPromises);
	});

	await Promise.all(importPromises);
};

const loadEvents = async () => {
	const eventsPath = join(__dirname, "events");
	const eventFiles = readdirSync(eventsPath).filter((file) => file.endsWith(extension));

	const eventsImportPromises = eventFiles.map(async (file) => {
		const filePath = join(eventsPath, file);
		try {
			const eventModule = await import(pathToFileURL(filePath).href);
			const event = eventModule.default || eventModule;

			console.log(`Cargando evento: ${event.name}`);

			if (event.once) {
				client.once(event.name, (...args: any[]) => event.execute(...args));
			} else {
				client.on(event.name, (...args: any[]) => event.execute(...args));
			}
		} catch (error) {
			console.error(`Error al cargar el evento ${filePath}:`, error);
		}
	});

	await Promise.all(eventsImportPromises);
};

const main = async () => {
	try {
		loadEnvVariables();
		await Promise.all([
			loadCommands().then(() => console.log("Comandos cargados.")),
			loadEvents().then(() => console.log("Eventos cargados.")),
			connect(process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/").then(() => console.log("Conectado a la base de datos.")),
		]).then(async () => await client.login(process.env.TOKEN_BOT));
	} catch (error) {
		console.error("Error en la inicialización:", error);
	}
};

main();
