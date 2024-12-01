import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { PostHandleable } from "../../types/middleware.js";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { increaseHomeMonthlyIncome } from "../../Models/Home.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { calculateJobMultiplier } from "../../utils/generic.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";

export default {
	group: "🎮 • Juegos",
	data: new SlashCommandBuilder()
		.setName("flipcoin")
		.setDescription("Tira la moneda y prueba tu suerte.")
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("la cantidad que quieres apostar (Máximo 4000)").setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("lado")
				.setDescription("Cara ó cruz")
				.setChoices([
					{ name: "Cara", value: "cara" },
					{ name: "Cruz", value: "cruz" },
				])
				.setRequired(true)
		),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("roulette", 3),
			deferInteraction(),
		],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			let side: string = interaction.options.getString("lado", true);
			let userData: IUserModel = await getOrCreateUser(interaction.user.id);

			if (amount < 1 || amount > 4000 || amount > userData.cash)
				return await replyError(
					interaction,
					`Se ingresó una cantidad inválida, debe ser ${
						amount < 100 ? "mayor que 100" : "menor que 500"
					} o no tienes suficiente dinero`
				);

			const flipcoin = ["cara", "cruz"][Math.floor(Math.random() * 2)];

			if (flipcoin == side) {
				amount += calculateJobMultiplier(userData.profile?.job, amount, userData.couples || []);
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
				.setAuthor({ name: "Cruz o cara", iconURL: "https://cdn.discordapp.com/emojis/911087695864950854.gif?size=96" })
				.setDescription(`Ha salido \`${flipcoin}\` y ${flipcoin == side ? "ganaste" : "perdiste"} ${Math.abs(amount)}.`)
				.setColor(flipcoin != side ? COLORS.errRed : COLORS.okGreen);

			await replyOk(interaction, [embed]);

			if (flipcoin == side) {
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
