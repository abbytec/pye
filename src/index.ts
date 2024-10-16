import dotenv from "dotenv";
dotenv.config({ path: "./.env" });
import { readdirSync } from "node:fs";
import path, { join } from "node:path";
import { ExtendedClient } from "./client";
import { Collection } from "discord.js";
import { connect } from "mongoose";
import { Command } from "./types/command";
import { pathToFileURL } from "node:url";

const client = new ExtendedClient();
client.commands = new Collection();
const isDevelopment = process.env.NODE_ENV === "development";

const commandFolders = readdirSync("./commands");
for (const folder of commandFolders) {
	const commandsPath = path.join(__dirname, "commands", folder);
	const extension = isDevelopment ? ".ts" : ".js";
	const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith(extension));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		try {
			const commandModule = await import(pathToFileURL(filePath).href);
			const command: Command = commandModule.default || commandModule;

			if (command.data) {
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
const eventFiles = readdirSync(eventsPath).filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

for (const file of eventFiles) {
	const filePath = join(eventsPath, file);
	try {
		const eventModule = await import(pathToFileURL(filePath).href);
		const event = eventModule.default;

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
	await connect(process.env.MONGO_URI ?? "http://127.0.0.1:27017/");
	console.log("conectado papi");
}
main().catch((err) => console.log(err));

// Log in to Discord with your client's token
client.login(process.env.tokenBot);
