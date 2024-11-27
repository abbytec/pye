import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { COLORS, getChannelFromEnv } from "../../utils/constants.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.ts";
import { Shop } from "../../Models/Shop.ts";
import { calculateJobMultiplier, checkRole } from "../../utils/generic.ts";
import { increaseHomeMonthlyIncome } from "../../Models/Home.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { checkQuestLevel, IQuest } from "../../utils/quest.ts";
const level = new Map();

export default {
    group: "🎮 • Juegos",
    data: new SlashCommandBuilder()
        .setName("chicken-fight")
        .setDescription("Apuesta dinero metiendo tu pollo a una pelea 🐔.")
        .addIntegerOption((option) => option.setName("cantidad").setDescription("la cantidad que quieres apostar (Máximo 500 pyecoins)").setRequired(true)),

    execute: composeMiddlewares(
        [verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
        async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
            let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
            let userData: IUserModel = await getOrCreateUser(interaction.user.id);

            // Verificar que el monto sea válido
            if (amount < 0 || amount > 300 || amount > userData.cash) return await replyError(interaction, "Se ingresó una cantidad inválida o no tienes suficiente dinero");

            // Verificar si el usuario posee el ítem en su inventario
            const data = await Shop.findOne({ name: { $regex: RegExp('chicken', 'gi') } }).lean().exec()
            if (!data) return replyError(interaction, 'Parece que el pollo aún no se encuentra en la tienda.\nUn administrador debe usar el comando `items` y agregarlo a la tienda.')
            if (!userData.inventory.includes(data._id)) return await replyError(interaction, "Necesitas comprar un pollo para ponerlo a pelear.'");

            // Calcular resultado según el nivel del pollo
            if (!level.has(interaction.user.id)) level.set(interaction.user.id, 49)
            const win = Math.random() < level.get(interaction.user.id) / 100 && level.get(interaction.user.id) < 80

            if (win) {
                amount += calculateJobMultiplier(userData.profile?.job, amount, userData.couples || [])
                // Subir 1 nivel al pollo
                level.set(interaction.user.id, level.get(interaction.user.id) + 1)
            } else {
                amount = 0 - amount;
            }

            try {
                await Users.updateOne({ id: interaction.user.id }, { $inc: { cash: amount } });
            } catch (error) {
                console.error("Error actualizando el usuario:", error);
                return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
            }

            // Crear embed de respuesta
            const embed = new EmbedBuilder()
                .setAuthor({ name: "Pelea de gallos", iconURL: "https://cdn.discordapp.com/emojis/911087695864950854.gif?size=96" })
                .setDescription(`Tu pollo 🐔 ha ${win ? "ganado" : "perdido"} la pelea y se te ${win ? "incrementaron" : "quitaron"} ${amount} PyE Coins.`)
                .setColor(win ? COLORS.errRed : COLORS.okGreen)
                .setTimestamp();

            await replyOk(interaction, [embed]);

            if (win) {
                try {
                    await increaseHomeMonthlyIncome(interaction.user.id, amount);
                    await checkQuestLevel({ msg: interaction, money: amount, userId: interaction.user.id } as IQuest);
                } catch (error) {
                    console.error("Error actualizando la quest:", error);
                }
            }
        }
    ),
};