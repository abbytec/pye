import { SlashCommandBuilder, ChatInputCommandInteraction, TextChannel, Message, EmbedBuilder } from "discord.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { IUser } from "../../interfaces/IUser.ts";
import { getOrCreateUser, Users } from "../../Models/User.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { increaseHomeMonthlyIncome } from "../../Models/Home.ts";
import { checkQuestLevel, IQuest } from "../../utils/quest.ts";

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
			let amount: number = interaction.options.getInteger("cantidad", true);
			let side: string = interaction.options.getString("lado", true);

			if (amount < 0) return replyError(interaction, "Se ingresó una cantidad inválida");

			let userData: Partial<IUser> = await getOrCreateUser(user.id);

			const flipcoin = ["cara", "cruz"][Math.floor(Math.random() * 2)];

			if (flipcoin != side) {
				userData.cash = (userData.cash ?? 0) - amount;
				userData.total = (userData.total ?? 0) - amount;
			} else {
				let profit = amount * 2;
				const userJob = userData.profile?.job;

				// Ajustar ganancia según el trabajo
				if (userJob === "Bombero" || userJob === "Bombera") {
					profit += profit * 0.35;
				}

				profit = Math.ceil(amount);

				// Actualizar el dinero del usuario
				userData.cash = (userData.cash ?? 0) + profit;
				userData.total = (userData.total ?? 0) + profit;
			}

			try {
				await Users.updateOne({ id: user.id }, userData).exec();
			} catch (error) {
				console.error("Error actualizando el usuario:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: "Cruz o cara", iconURL: "https://cdn.discordapp.com/emojis/911087695864950854.gif?size=96" })
				.setDescription(
					`Ha salido \`${flipcoin === "cruz" ? "cara" : "cruz"}\` y ${(flipcoin == side) === true ? "perdiste" : "ganaste"} ${amount}.`
				)
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
