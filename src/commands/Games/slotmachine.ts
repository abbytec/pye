import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { increaseHomeMonthlyIncome } from "../../Models/Home.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { calculateJobMultiplier } from "../../utils/generic.js";
import { IUserModel, Users, getOrCreateUser } from "../../Models/User.js";
import { replyError } from "../../utils/messages/replyError.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
const emojis = ["🍒", "🍉", "🍑", "🥥", "🍍", "🍇", "🥝", "🍄", "🍓", "🍀"];

export default {
	group: "🎮 • Juegos",
	data: new SlashCommandBuilder()
		.setName("slotmachine")
		.setDescription("Tira del tragaperras y apuesta tu dinero.")
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("la cantidad que quieres apostar (Máximo 900)").setRequired(true)
		),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("slotmachine", 3000),
			deferInteraction(),
		],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			let userData: IUserModel = await getOrCreateUser(interaction.user.id);
			if (amount < 1 || amount > 900 || amount > userData.cash)
				return replyError(
					interaction,
					`Se ingresó una cantidad inválida, debe ser ${amount < 100 ? "mayor que 100" : "menor que 900"
					} o no tienes suficiente dinero`
				);

			const game = [[], [], []].map(() => [Math.random(), Math.random(), Math.random()].map((v) => Math.floor(v * 7)));
			const loseWinRate = Math.random() < 0.5;

			// Crear embed de respuesta
			const embed = new EmbedBuilder().setAuthor({
				name: interaction.user.username, iconURL: interaction.user.displayAvatarURL()
			});

			if (loseWinRate || (game[1][1] == game[1][2] && game[1][1] == game[1][0])) {
				game[1][1] = game[1][2] = game[1][0];
				amount += calculateJobMultiplier(userData.profile?.job, amount, userData.couples || []);
				embed.setDescription(`Has ganado ${amount}.\n
                    ${game.map((l, i) => l.map((n) => (i === 1 ? pyecoin : emojis[n])).join(" | ") + (i === 1 ? " ⬅" : "")).join("\n")}
                    `);
				embed.setColor(COLORS.okGreen);
			} else {
				amount = 0 - amount;
				embed.setDescription(`Has perdido ${amount}.\n
                    ${game.map((l, i) => l.map((n) => emojis[n]).join(" | ") + (i === 1 ? " ⬅" : "")).join("\n")}
                    `);
				embed.setColor(COLORS.errRed);
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
				}
			}
		}
	),
};
