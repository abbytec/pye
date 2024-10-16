// src/deploy-commands.ts
import dotenv from "dotenv";
dotenv.config({ path: "./.env" });

import { REST, Routes } from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { Command } from "./types/command"; // Asegúrate de tener esta interfaz
import { pathToFileURL } from "node:url";

const token = process.env.tokenBot;
const clientId = process.env.clientId;
const guildId = process.env.guildId;
const commands: any[] = [];

if (!token || !clientId || !guildId) {
	throw new Error("Las variables de entorno tokenBot, clientId y guildId deben estar definidas.");
}

// Obtiene todas las carpetas de comandos
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// Obtiene todos los archivos de comandos dentro de cada carpeta
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".ts") || file.endsWith(".js"));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const commandModule = await import(pathToFileURL(filePath).href);
		const command: Command = commandModule.default || commandModule;
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
		const data = await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands }) as any;

		console.log(`Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error(error);
	}
})();
