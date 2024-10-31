import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Pong!"),
    
    async execute(interaction: ChatInputCommandInteraction) {
        // Enviar la respuesta "Pong!"
        await interaction.reply("Pong!");
    },
};
