const { SlashCommandBuilder, EmbedBuilder } = require('discord.js')


module.exports = {
    data: new SlashCommandBuilder()
        .setName('sugerir')
        .setDescription('Envía tu sugerencia para mejorar el servidor')
        .addStringOption(option =>
            option
                .setName('sugerencia')
                .setDescription('qué tienes en mente para el servidor')
                .setMinLength(40)
                .setRequired(true)

        )
    ,
    async execute(interaction) {


        args = await interaction.options.getString('sugerencia')
        let canal = interaction.client.channels.resolve('932011356213899274')

        let suggest = new EmbedBuilder()
            .setColor(0x1414b8)
            .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL({ dynamic: true }) })
            .setTitle('Nueva sugerencia !')
            .setDescription(args)
            .setTimestamp()
            .setFooter({ text: 'Puedes votar a favor o en contra de esta sugerencia', })

        interaction.reply('<:check:1282933528580849664> - Se ha enviado tu sugerencia correctamente.')

        canal.send({
            embeds: [
                suggest
            ]
        }).then(m => {
            m.react('1282933528580849664').catch(() => null)
            m.react('1282933529566511155').catch(() => null)
            m.startThread({ name: `Sugerencia por ${interaction.user.username}` }).then(c => c.send(`<@${interaction.user.id}>`)).catch(() => null)
        }).catch(() => null)
    }
}
