// src/deploy-commands.ts
import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path, { dirname } from "node:path";
import { Command } from "./types/command.js"; // Asegúrate de tener esta interfaz
import { fileURLToPath, pathToFileURL } from "node:url";
import loadEnvVariables from "./utils/environment.js";
import { exit } from "node:process";

const isDevelopment = process.env.NODE_ENV === "development";
loadEnvVariables();

const __dirname = dirname(fileURLToPath(import.meta.url));

const token = process.env.TOKEN_BOT;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const commands: any[] = [];
if (!token || !clientId || !guildId) {
	throw new Error("Las variables de entorno TOKEN_BOT, CLIENT_ID y GUILD_ID deben estar definidas.");
}

// Obtiene todas las carpetas de comandos
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// Obtiene todos los archivos de comandos dentro de cada carpeta
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".ts"));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const commandModule = await import(pathToFileURL(filePath).href);
		const command: Command = commandModule.default || commandModule;
		console.log(commandModule);
		if ("data" in command && "execute" in command) {
			commands.push(command.data.toJSON());
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

// Construye una instancia del módulo REST
const rest = new REST({ version: "10" }).setToken(token);

// Despliega los comandos
(async () => {
	try {
		console.log(`Started refreshing ${commands.length} application (/) commands.`);

		// Usa 'applicationGuildCommands' para comandos de servidor específico
		const data = (await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands })) as any;

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})().then(() => exit(0));
