const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isChatInputCommand()) return;

        console.log(interaction);

        const command = interaction.client.commands.get(interaction.commandName);


        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        if (command && interaction.isAutocomplete()) {
            const command = interaction.client.commands.get(interaction.commandName);
            await command.autocomplete(interaction);
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'Un error ejecutando este comando!', ephemeral: true });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
        }


    }
}



