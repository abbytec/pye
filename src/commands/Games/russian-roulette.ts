import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel, Guild } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { increaseHomeMonthlyIncome } from "../../Models/Home.ts";
import { IUserModel, getOrCreateUser, Users } from "../../Models/User.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.ts";
import { calculateJobMultiplier } from "../../utils/generic.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { checkQuestLevel, IQuest } from "../../utils/quest.ts";
import { replyInfo } from "../../utils/messages/replyInfo.ts";

let data: {
  fin: number;
  apuestaMin: number;
  apuestas: { jugador: string; cantidad: number }[];
  intervalo?: NodeJS.Timeout;
} = {
  fin: -1,
  apuestaMin: 0,
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
          russianRoulette(interaction)
        }, 30e3)
        data.intervalo = intervalo
      }
      // Añadir apuestas si no están jugando ya
      const jugador = data.apuestas.find((apu) => apu.jugador === interaction.user.id)
      if (!jugador) {
        data.apuestas.push({ jugador: interaction.user.id, cantidad: amount })
      } else {
        return await replyError(interaction, "Ya te encuentras dentro del juego")
      }
      if (amount >= data.apuestaMin) {
        data.apuestaMin = amount
      } else {
        return await replyError(interaction, `No puedes apostar un monto menor a ${data.apuestaMin}`)
      }
      if (data.apuestas.length === 6) {
        return await replyError(interaction, `Ya hay 6 jugadores en la ruleta`)
      }

      // Mensaje de respuesta del comando

      return await replyInfo(interaction, `Tu apuesta (${amount}${pyecoin}) se realizó con éxito. Aún faltan ${Math.round((data.fin - Date.now()) / 1000)} segundos para comenzar.`)
    }
  ),
};

async function russianRoulette(interaction: ChatInputCommandInteraction) {
  data.fin = -1
  if (data.apuestas.length == 1) {
    data.apuestas.push({ jugador: process.env.CLIENT_ID ?? "", cantidad: data.apuestas[0].cantidad })
  }
  const ganador: string = data.apuestas[Math.floor(Math.random() * data.apuestas.length)].jugador
  const canal = interaction.client.channels.cache.get(getChannelFromEnv("casinoPye")) as TextChannel | undefined;
  if (!canal) return

  let userData: IUserModel = await getOrCreateUser(ganador);
  for (let i = 0; i < data.apuestas.length; i++) {
    // Calcular resultado de cada jugador
    if (data.apuestas[i].jugador == process.env.CLIENT_ID) {
      if (ganador == data.apuestas[i].jugador) {
        await canal.send({
          embeds: [new EmbedBuilder()
            .setAuthor({ name: "Un vagabundo", iconURL: (interaction.guild as Guild).iconURL() ?? undefined })
            .setDescription(`\`Un vagabundo\` tiró del gatillo y sobrevivió!`)
            .setColor(COLORS.okGreen)
            .setThumbnail('https://cdn.discordapp.com/emojis/918275419902464091.png?size=96')
          ]
        })
      } else {
        await canal.send({
          embeds: [new EmbedBuilder()
            .setAuthor({ name: "Un vagabundo", iconURL: (interaction.guild as Guild).iconURL() ?? undefined })
            .setDescription(`\`Un vagabundo\` tiró del gatillo por ${i + 1}ª vez y no sobrevivió para contarla... <:rip:917865084997484645>`)
            .setColor(COLORS.errRed)
            .setThumbnail('https://cdn.discordapp.com/emojis/770482910918082571.png?size=96')]
        })
      }
      continue
    }
    if (ganador === data.apuestas[i].jugador) {
      data.apuestas[i].cantidad += calculateJobMultiplier(userData.profile?.job, data.apuestas[i].cantidad, userData.couples || [])
    } else {
      data.apuestas[i].cantidad = 0 - data.apuestas[i].cantidad
    }
    // Actualizar su dinero del banco, quest e income
    try {
      await Users.updateOne({ id: data.apuestas[i].jugador }, { $inc: { cash: data.apuestas[i].cantidad } });
    } catch (error) {
      console.error("Error actualizando el usuario:", error);
      const embed = new EmbedBuilder()
        .setAuthor({ name: 'Ruleta' })
        .setDescription(`Hubo un error actualizando el monto de <@${data.apuestas[i].jugador}>.`)
        .setThumbnail('https://media.discordapp.net/attachments/687397125793120288/917501566527868968/spin.gif')
        .setTimestamp();
      await canal.send({ embeds: [embed] });
    }
    try {
      await increaseHomeMonthlyIncome(data.apuestas[i].jugador, data.apuestas[i].cantidad);
      await checkQuestLevel({ msg: interaction, money: data.apuestas[i].cantidad, userId: data.apuestas[i].jugador } as IQuest);
    } catch (error) {
      console.error("Error actualizando la quest:", error);
    }
    // Enviar mensajes de ganadores y perdedores
    if (ganador === data.apuestas[i].jugador) {
      await canal.send({
        embeds: [new EmbedBuilder()
          .setAuthor({ name: interaction.guild?.members.resolve(ganador)?.user.tag || "Anónimo", iconURL: interaction.guild?.members.resolve(ganador)?.user.displayAvatarURL() })
          .setDescription(`\`${interaction.guild?.members.resolve(ganador)?.user.tag}\` tiró del gatillo y sobrevivió !`) // Sería absurdo decir el número de disparo, ya que si ya se disparó no tiene sentido seguir intentando
          .setColor(COLORS.okGreen)
          .setThumbnail('https://cdn.discordapp.com/emojis/918275419902464091.png?size=96')
        ]
      })
    } else {
      await canal.send({
        embeds: [new EmbedBuilder()
          .setAuthor({ name: interaction.guild?.members.resolve(data.apuestas[i].jugador)?.user.tag || "Anónimo", iconURL: interaction.guild?.members.resolve(data.apuestas[i].jugador)?.user.displayAvatarURL() })
          .setDescription(`\`${interaction.guild?.members.resolve(data.apuestas[i].jugador)?.user.tag}\` tiró del gatillo por ${i + 1}ª vez y no sobrevivió para contarla... <:rip:917865084997484645>`)
          .setColor(COLORS.errRed)
          .setThumbnail('https://cdn.discordapp.com/emojis/770482910918082571.png?size=96')]
      })
    }
  }
}