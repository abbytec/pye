import loadEnvVariables from "./utils/environment.ts";
const isDevelopment = process.env.NODE_ENV === "development";

loadEnvVariables();
import { readdirSync } from "node:fs";
import path, { dirname, join } from "node:path";
import { ExtendedClient } from "./client.ts";
import { Collection } from "discord.js";
import { connect } from "mongoose";
import { Command } from "./types/command.ts";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const client = new ExtendedClient();
client.commands = new Collection();
const extension = isDevelopment ? ".ts" : ".js";

const commandFolders = readdirSync(__dirname + "/commands");
for (const folder of commandFolders) {
	const commandsPath = path.join(__dirname, "commands", folder);
	const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith(extension));

	for (const file of commandFiles) {
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
	}
}

//event handler, manejador de eventos
const eventsPath = join(__dirname, "events");
const eventFiles = readdirSync(eventsPath).filter((file) => file.endsWith(extension));
for (const file of eventFiles) {
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
}

//conectar la base de datos con mongoose
async function main() {
	await connect(process.env.MONGO_URI ?? "mongodb://127.0.0.1:27017/");
	console.log("conectado papi");
}
main().catch((err) => console.log(err));

// Log in to Discord with your client's token
client
	.login(process.env.TOKEN_BOT)
	.then(() => console.log("bot listo papi"))
	.catch((err) => console.log(err));
