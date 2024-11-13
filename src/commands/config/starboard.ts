import { ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { StarBoard } from "../../Models/StarBoard.ts";
import { Command } from "../../types/command.ts";
const { ROLES } = require('../../Utils/constants');

const data = new SlashCommandBuilder()
	.setName("starboard")
	.setDescription("Establece el canal del starboard y las estrellas necesarias.")
	.addStringOption((option) =>
		option.setName("canal").setDescription("Canal de texto donde se enviarán los mensajes de starboard").setRequired(true)
	)
	.addStringOption((option) =>
		option.setName("estrellas").setDescription("La cantidad de estrellas mínimo para mostrar").setRequired(true)
	);

async function starboard(channel: TextChannel, stars: number, interaction: ChatInputCommandInteraction) {
	await StarBoard.updateOne(
		{ id: interaction.client.user?.id },
		{ channel: channel.id, stars: stars },
		{ upsert: true }
	);

	await interaction.reply(`<:check:913199297678434374> - Se ha establecido el canal ${channel.toString()}\nTotal de reacciones requeridas: \`${stars}\` .`);
}

async function execute(interaction: ChatInputCommandInteraction) {
	const canal = interaction.options.getString("canal");
	const stars = interaction.options.getString("estrellas");

	const starsCount = Number(stars);
	if (isNaN(starsCount)) {
		await interaction.reply('La cantidad de estrellas debe ser un número válido.');
		return
	}

	if (canal == null) {
		await interaction.reply("Se necesita un id de canal para guardar")
		return
	}

	const channel = interaction.guild?.channels.cache.get(canal) as TextChannel;

	await starboard(channel, starsCount, interaction);
}

// Export command
const sugerirCommand: Command = {
	data,
	execute,
};

export default sugerirCommand;
