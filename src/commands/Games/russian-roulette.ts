import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { increaseHomeMonthlyIncome } from "../../Models/Home.ts";
import { IUserModel, getOrCreateUser, Users } from "../../Models/User.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.ts";
import { calculateJobMultiplier } from "../../utils/generic.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyWarning } from "../../utils/messages/replyWarning.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { checkQuestLevel, IQuest } from "../../utils/quest.ts";

let data: {
  fin: number;
  apuestas: { jugador: string; cantidad: number }[];
  intervalo?: NodeJS.Timeout;
} = {
  fin: -1,
  apuestas: [],
  intervalo: undefined,
};
export default {
  data: new SlashCommandBuilder()
    .setName("russian-roulette")
    .setDescription("Inicia un juego de ruleta o coloca tu apuesta en un juego existente.")
    .addIntegerOption((option) => option.setName("cantidad").setDescription("la cantidad que quieres apostar (Máximo 1000)").setRequired(true)),

  execute: composeMiddlewares(
    [verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
    async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
      let userData: IUserModel = await getOrCreateUser(interaction.user.id);
      let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
      // Validar datos
      if (amount < 0 || amount > 1000 || amount > userData.cash) return replyError(interaction, `Se ingresó una cantidad inválida, debe ser ${amount < 100 ? "mayor que 100" : "menor que 500"} o no tienes suficiente dinero`);
      // Comenzar el juego
      if (data.fin == -1) {
        data.fin = Date.now() + 30e3
        let apuestas: { jugador: string; cantidad: number }[] = []
        data.apuestas = apuestas
        let intervalo: NodeJS.Timeout = setTimeout(() => {
          russianrulette(interaction)
        }, 1e3)
        data.intervalo = intervalo
      }
      // Añadir apuestas si no están jugando ya
      for (const apuesta of data.apuestas) {
        const jugador = data.apuestas.find((apu) => apu.jugador === apuesta.jugador)
        if (!jugador) {
          data.apuestas?.push({ jugador: interaction.user.id, cantidad: amount })
        } else {
          replyError(interaction, ":cross_custom: - Ya te encuentras dentro del juego")
        } if (apuesta.cantidad < amount) {
          replyError(interaction, `:cross_custom: - No puedes apostar un monto menor a ${apuesta.cantidad}`)
        } else if (data.apuestas.length = 6) {
          replyError(interaction, `:cross_custom: - Ya hay 6 jugadores en la ruleta`)
        }
      }
      // Mensaje de respuesta del comando
      await replyOk(interaction, `Tu apuesta (${amount}${pyecoin}) se realizó con éxito. Aún faltan ${Math.round((data.fin - Date.now()) / 1000)} segundos para comenzar.`)
    }
  ),
};

async function roulette(interaction: ChatInputCommandInteraction) {  // Se ejecuta luego de 30s
  data.fin = -1
  if (data.apuestas.length <= 1) {
    (interaction.client.channels.cache.get(getChannelFromEnv("casinoPye")) as TextChannel | undefined)?.send({
      embeds: [new EmbedBuilder()
        .setAuthor({ name: 'Ruleta rusa' }) // Agregar iconurl
        .setDescription(`No se ha podido iniciar la ruleta rusa por falta de jugadores`)
        .setThumbnail('https://media.discordapp.net/attachments/687397125793120288/917501566527868968/spin.gif')
      ]
    })
    return
  }
  let res = Math.floor(Math.random() * data.apuestas.length)
  const apuestas: { jugador: string; cantidad: number }[] = data.apuestas
  const ganador: { jugador: string; cantidad: number } = apuestas[res]
  let userData: IUserModel = await getOrCreateUser(ganador.jugador);
  if (res) {
    ganador.cantidad = calculateJobMultiplier(userData.profile?.job, ganador.cantidad, userData.couples || [])
  } else {
    ganador.cantidad = 0 - ganador.cantidad
  }
  try {
    await Users.updateOne({ id: ganador.jugador }, { $inc: { cash: ganador.cantidad } });
  } catch (error) {
    console.error("Error actualizando el usuario:", error);
    const embed = new EmbedBuilder()
      .setAuthor({ name: 'Ruleta' })
      .setDescription(`Hubo un error actualizando el monto de <@${ganador.jugador}>.`)
      .setThumbnail('https://media.discordapp.net/attachments/687397125793120288/917501566527868968/spin.gif')
      .setTimestamp();
    const canal = interaction.client.channels.cache.get(getChannelFromEnv("casinoPye")) as TextChannel | undefined;
    if (!canal) return
    await canal.send({ embeds: [embed] });
  }
  try {
    await increaseHomeMonthlyIncome(ganador.jugador, ganador.cantidad);
    await checkQuestLevel({ msg: interaction, money: ganador.cantidad, userId: ganador.jugador } as IQuest);
  } catch (error) {
    console.error("Error actualizando la quest:", error);
  }
}


// agregar los mensajes que siguen con delay
/* if (resultado.cantidad < 0) {
  msg += `<@${resultado.jugador}> ha perdido ${pyecoin} **${Math.abs(resultado.cantidad).toLocaleString()}**.\n`;
} else if (resultado.cantidad > 0) {
  msg += `<@${resultado.jugador}> ha ganado ${pyecoin} **${resultado.cantidad.toLocaleString()}**.\n`;

} else {
  msg += `<@${resultado.jugador}> no ha perdido ${pyecoin}, sus pérdidas se cancelaron con sus ganancias.\n`;
}
}
// Enviar mensaje al terminar los 30s con los ganadores y perdedores
(interaction.client.channels.cache.get(getChannelFromEnv("casinoPye")) as TextChannel | undefined)?.send({
  embeds: [new EmbedBuilder()
    .setAuthor({ name: 'Ruleta rusa' })
    .setDescription(`.`)
    .setThumbnail('https://media.discordapp.net/attachments/687397125793120288/917501566527868968/spin.gif')
    .setTimestamp()
  ]
})

  let hit = players[Math.floor(Math.random() * players.length)]

  for (const Player of players) {
    if (Player == hit) {
      msg.channel.send({
        embeds: [new EmbedBuilder()
          .setAuthor({ name: msg.guild.members.resolve(Player).user.tag, iconURL: msg.guild.members.resolve(Player).user.displayAvatarURL({ dynamic: true }) })
          .setDescription(`\`${msg.guild.members.resolve(Player).user.tag}\` tiró del gatillo y no sobrevivió para contarla... <:rip:917865084997484645>`)
          .setThumbnail('https://cdn.discordapp.com/emojis/770482910918082571.png?size=96')]
      })
      return { alive: players.filter((x) => x !== hit), dead: hit }
    }

    msg.channel.send({
      embeds: [new EmbedBuilder()
        .setAuthor({ name: msg.guild.members.resolve(Player).user.tag, iconURL: msg.guild.members.resolve(Player).user.displayAvatarURL({ dynamic: true }) })
        .setDescription(`\`${msg.guild.members.resolve(Player).user.tag}\` tiró del gatillo y sobrevivió !`)
        .setThumbnail('https://cdn.discordapp.com/emojis/918275419902464091.png?size=96')
      ]
    })
    await delayFor(4000)
  }
}

function delayFor(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
} */