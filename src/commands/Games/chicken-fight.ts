import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { replyError } from "../../utils/messages/replyError.js";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.js";
import { Shop } from "../../Models/Shop.js";
import { calculateJobMultiplier, checkRole } from "../../utils/generic.js";
import { increaseHomeMonthlyIncome } from "../../Models/Home.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
const level = new Map();

export default {
	group: "🎮 • Juegos",
	data: new SlashCommandBuilder()
		.setName("chicken-fight")
		.setDescription("Apuesta dinero metiendo tu pollo a una pelea 🐔.")
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("la cantidad que quieres apostar (Máximo 750 pyecoins)").setRequired(true)
		),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("chicken-fight", 3000),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			let userData: IUserModel = await getOrCreateUser(interaction.user.id);

			// Verificar que el monto sea válido
			if (amount < 0 || amount > 750 || amount > userData.cash)
				return await replyError(interaction, "Se ingresó una cantidad inválida o no tienes suficiente dinero");

			// Verificar si el usuario posee el ítem en su inventario
			const data = await Shop.findOne({ name: { $regex: /chicken/gi } })
				.lean()
				.exec();
			if (!data)
				return replyError(
					interaction,
					"Parece que el pollo aún no se encuentra en la tienda.\nUn administrador debe usar el comando `items` y agregarlo a la tienda."
				);
			if (!userData.inventory.includes(data._id))
				return await replyError(interaction, "Necesitas comprar un pollo para ponerlo a pelear.'");

			// Calcular resultado según el nivel del pollo
			if (!level.has(interaction.user.id)) level.set(interaction.user.id, 49);
			const win = Math.random() < level.get(interaction.user.id) / 100 && level.get(interaction.user.id) < 80;

			if (win) {
				amount += calculateJobMultiplier(userData.profile?.job, amount, userData.couples || []);
				// Subir 1 nivel al pollo
				level.set(interaction.user.id, level.get(interaction.user.id) + 1);
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
				.setAuthor({ name: interaction.user.username, iconURL: interaction.user.avatar ?? "" })
				.setDescription(
					`Tu pollo 🐔 ha ${win ? "ganado" : "perdido"} la pelea y se te ${win ? "incrementaron" : "quitaron"} ${amount} PyE Coins.`
				)
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
} as Command;
