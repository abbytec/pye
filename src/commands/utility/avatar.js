const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')


module.exports = {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Muestra el avatar de un usuario')
        .addUserOption(option =>
            option
                .setName('usuario')
                .setDescription('menciona a un usuario')
                .setRequired(true)
        ),
    async execute(interaction) {

        const user = await interaction.options.getUser('usuario');

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle(`Avatar de ${user.username}`)
            .addFields([{
                name: '❥╏Links',
                value: `[Google](https://lens.google.com/uploadbyurl?url=${user.displayAvatarURL({ dynamic: true, size: 1024 })}) | [JPG](${user.displayAvatarURL({ format: 'jpg', size: 1024 })})`
            }])
            .setImage(user.displayAvatarURL({ dynamic: true, size: 1024 }))
            .setFooter({ text: `ID de ${user.username}: ${user.id}`, });

        interaction.reply({ embeds: [embed] });

    }
}