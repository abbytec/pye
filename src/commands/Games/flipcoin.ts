import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { increaseHomeMonthlyIncome } from "../../Models/Home.ts";
import { checkQuestLevel, IQuest } from "../../utils/quest.ts";
import { calculateJobMultiplier } from "../../utils/generic.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("flipcoin")
		.setDescription("Tira la moneda y prueba tu suerte.")
		.addIntegerOption((option) => option.setName("cantidad").setDescription("la cantidad que quieres apostar").setRequired(true))
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
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const user = interaction.user;
			let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			let side: string = interaction.options.getString("lado", true);

			if (amount < 0) return replyError(interaction, "Se ingresó una cantidad inválida");
			if (amount > 4000) return replyError(interaction, "No puedes apostar mas de 4000 PyE Coins.");

			let userData: IUserModel = await getOrCreateUser(user.id);

			const flipcoin = ["cara", "cruz"][Math.floor(Math.random() * 2)];

			if (amount > userData.cash) return await replyError(interaction, "No tienes suficientes PyE Coins para apostar.");

			if (flipcoin == side) {
				amount = calculateJobMultiplier(userData.profile?.job, amount, userData.couples || [])
			} else {
				amount = 0 - amount;
			}

			try {
				await Users.updateOne({ id: user.id }, { $inc: { cash: amount } });
			} catch (error) {
				console.error("Error actualizando el usuario:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: "Cruz o cara", iconURL: "https://cdn.discordapp.com/emojis/911087695864950854.gif?size=96" })
				.setDescription(`Ha salido \`${flipcoin}\` y ${flipcoin == side ? "ganaste" : "perdiste"} ${Math.abs(amount)}.`)
				.setColor(flipcoin != side ? COLORS.errRed : COLORS.okGreen)
				.setTimestamp();

			await replyOk(interaction, [embed]);

			if (flipcoin == side) {
				try {
					await increaseHomeMonthlyIncome(user.id, amount);
					await checkQuestLevel({ msg: interaction, money: amount, userId: user.id } as IQuest);
				} catch (error) {
					console.error("Error actualizando la quest:", error);
					// Opcional: puedes enviar una advertencia al usuario o simplemente registrar el error
				}
			}
		}
	),
};
