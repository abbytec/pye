import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.ts"
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { increaseHomeMonthlyIncome } from "../../Models/Home.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { checkQuestLevel, IQuest } from "../../utils/quest.ts";
import { calculateJobMultiplier } from "../../utils/generic.ts";
import { IUserModel, Users, getOrCreateUser } from "../../Models/User.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.ts";
const emojis = ['🍒', '🍉', '🍑', '🥥', '🍍', '🍇', '🥝', '🍄', '🍓', '🍀']

export default {
    group: "🎮 • Juegos",
    data: new SlashCommandBuilder()
        .setName("slotmachine")
        .setDescription("Tira del tragaperras y apuesta tu dinero.")
        .addIntegerOption((option) => option.setName("cantidad").setDescription("la cantidad que quieres apostar (Máximo 300)").setRequired(true)),

    execute: composeMiddlewares(
        [verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), verifyCooldown("roulette", 3), deferInteraction()],
        async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
            let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
            let userData: IUserModel = await getOrCreateUser(interaction.user.id);
            if (amount < 1 || amount > 300 || amount > userData.cash) return replyError(interaction, `Se ingresó una cantidad inválida, debe ser ${amount < 100 ? "mayor que 100" : "menor que 500"} o no tienes suficiente dinero`);

            const game = [[], [], []].map(() => [Math.random(), Math.random(), Math.random()].map((v) => Math.floor(v * 7)))
            const loseWinRate = Math.random() < 0.5

            // Crear embed de respuesta
            const embed = new EmbedBuilder()
                .setAuthor({ name: "🎰 Tragamonedas 🎰", iconURL: "https://cdn.discordapp.com/emojis/911087695864950854.gif?size=96" });

            if (loseWinRate || (game[1][1] == game[1][2] && game[1][1] == game[1][0])) {
                game[1][1] = game[1][2] = game[1][0]
                amount += calculateJobMultiplier(userData.profile?.job, amount, userData.couples || [])
                embed.setDescription(`Has ganado ${amount}.\n
                    ${game.map((l, i) =>
                    l.map((n) => (i === 1 ? pyecoin : emojis[n]))
                        .join(' | ') + (i === 1 ? ' ⬅' : ''))
                        .join('\n')}
                    `)
                embed.setColor(COLORS.okGreen)
            } else {
                amount = 0 - amount
                embed.setDescription(`Has perdido ${amount}.\n
                    ${game.map((l, i) =>
                    l.map((n) => (emojis[n]))
                        .join(' | ') + (i === 1 ? ' ⬅' : ''))
                        .join('\n')}
                    `)
                embed.setColor(COLORS.errRed)
            }

            try {
                await Users.updateOne({ id: interaction.user.id }, { $inc: { cash: amount } });
            } catch (error) {
                console.error("Error actualizando el usuario:", error);
                return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
            }

            await replyOk(interaction, [embed]);

            if (loseWinRate || (game[1][1] == game[1][2] && game[1][1] == game[1][0])) {
                try {
                    await increaseHomeMonthlyIncome(interaction.user.id, amount);
                    await checkQuestLevel({ msg: interaction, money: amount, userId: interaction.user.id } as IQuest);
                } catch (error) {
                    console.error("Error actualizando la quest:", error);
                    // Opcional: puedes enviar una advertencia al usuario o simplemente registrar el error
                }
            }
        }
    ),
};