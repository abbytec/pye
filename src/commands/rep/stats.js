const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js')

const roles = {
    novato: {
        id: 'novato',
        label: 'Novato',
        headlineColor: '#645e65',
        contentColor: '#c5c5c5',
    },
    iniciante: {
        id: 'iniciante',
        label: 'Iniciante',
        headlineColor: '#645e65',
        contentColor: '#b296b7',
    },
    regular: {
        id: 'regular',
        label: 'Regular',
        headlineColor: '#645e65',
        contentColor: '#d592f4',
    },
    avanzado: {
        id: 'avanzado',
        label: 'Avanzado',
        headlineColor: '#645e65',
        contentColor: '#96298b',
    },
    veterano: {
        id: 'veterano',
        label: 'Veterano',
        headlineColor: '#8b2154',
        contentColor: '#ff2b91',
    },
    sabio: {
        id: 'sabio',
        label: 'Sabio',
        headlineColor: '#774292',
        contentColor: '#c248ff',
    },
    experto: {
        id: 'experto',
        label: 'Experto',
        headlineColor: '#8d804a',
        contentColor: '#fbc900',
    },
    adalovelace: {
        id: 'adalovelace',
        label: 'Ada Lovelace',
        headlineColor: '#a34c2a',
        contentColor: '#ff6427',
    },
    alanturing: {
        id: 'alanturing',
        label: 'Alan Turing',
        headlineColor: '#0f8696',
        contentColor: '#00cce7',
    },
}

function formatNumber(numStr) {
    let num = parseFloat(numStr.replace(/,/g, ''));

    if (isNaN(num)) {
        return '-';
    }

    if (num < 1000) {
        return num.toString();
    } else if (num < 1000000) {
        // Redondea al millar más cercano y luego divide por 1000
        return Math.round(num / 1000).toString() + 'k';
    } else {
        // Redondea al millón más cercano y luego divide por 1000000
        return Math.round(num / 1000000).toString() + 'M';
    }
}




module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Muestra todas las estadisticas de tu perfil dentro del servidor'),
    async execute(msg, [user]) {
        // get user
        const member = user
            ? msg.mentions.members.first() ||
            (await msg.guild.members.fetch(user).catch(() => null)) ||
            msg.member
            : msg.member

        // validate bot
        if (member.user.bot)
            return this.sendEmbed(
                msg,
                '<:cross_custom:913093934832578601> - Los bots no pueden tener puntos de ayuda.',
                true
            )

        // get data
        let data = await HelperPoint.findOne({ _id: member.id })
        if (!data) {
            data = { points: 0 }
        }
        let people = await HelperPoint.find().sort({ points: -1 }).exec()

        const points = data.points.toLocaleString()
        const userData = await Users.findOne({ id: member.id }).exec()
        const pyeCoins = userData.bank?.toLocaleString() || '-'
        const rank =
            (
                people.findIndex((memberFromDB) => memberFromDB._id === member.id) + 1
            ).toLocaleString() || '-'
        const avatar = await loadImage(
            member.user.displayAvatarURL({ extension: 'png', forceStatic: true })
        )
        const name =
            member.user.username.length > 9
                ? member.user.username.substring(0, 8).trim() + '...'
                : member.user.username

        const role = this.getRole(member)
        if (!role) return

        const background = await loadImage(
            path.join(
                __dirname,
                `../../Utils/Images/reputation/${!TestMode
                    ? REP_ROLES_IMG_NAMES[role.id]
                    : TEST_REP_ROLES_IMG_NAMES[role.id]
                }.jpg`
            )
        )

        const canvas = this.getRender({
            name,
            points,
            rank,
            avatar,
            background,
            pyeCoins,
            role,
        })

        // send avatar
        return msg.channel
            .send({
                files: [new AttachmentBuilder(canvas.toBuffer(), { name: 'rank.png' })],
            })
            .catch(() => null)
    }
}







