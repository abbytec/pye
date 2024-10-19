import { Events, Interaction } from "discord.js";
import { ExtendedClient } from "../client.ts";

export default {
	name: Events.InteractionCreate,
	async execute(interaction: Interaction) {
		// Verifica si la interacción es un comando de texto
		if (!interaction.isChatInputCommand()) return;

		const command = (interaction.client as ExtendedClient).commands.get(interaction.commandName);

		if (!command) {
			console.error(`No command matching ${interaction.commandName} was found.`);
			return;
		}

		// Ejecutar el comando
		try {
			await command.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: "Un error ejecutando este comando!", ephemeral: true });
			} else {
				await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
			}
		}
	},
};
