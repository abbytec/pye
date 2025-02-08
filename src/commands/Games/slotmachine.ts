import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { calculateJobMultiplier } from "../../utils/generic.js";
import { IUserModel, betDone, getOrCreateUser } from "../../Models/User.js";
import { replyError } from "../../utils/messages/replyError.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
const emojis = ["🍒", "🍉", "🍑", "🥥", "🍍", "🍇", "🥝", "🍄", "🍓", "🍀"];
export default {
	group: "🎮 • Juegos",
	data: new SlashCommandBuilder()
		.setName("slotmachine")
		.setDescription("Tira del tragaperras y apuesta tu dinero.")
		.addIntegerOption((option) => option.setName("cantidad").setDescription(`la cantidad que quieres apostar`).setRequired(true)),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("slotmachine", 1000),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			let initialAmount = amount;
			let userData: IUserModel = await getOrCreateUser(interaction.user.id);
			if (amount <= 100 || amount > ExtendedClient.getGamexMaxCoins(2.3) || amount > userData.cash)
				return replyError(
					interaction,
					`Se ingresó una cantidad inválida, debe ser ${
						amount < 100 ? "mayor que 100" : `menor que${ExtendedClient.getGamexMaxCoins(2.3)}`
					} o no tienes suficiente dinero`
				);

			const game = [[], [], []].map(() => [Math.random(), Math.random(), Math.random()].map((v) => Math.floor(v * 7)));
			const loseWinRate = Math.random() < 0.45;

			// Crear embed de respuesta
			const embed = new EmbedBuilder().setAuthor({
				name: interaction.user.username,
				iconURL: interaction.user.displayAvatarURL(),
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
			embed.setTitle("🎰 Tragamonedas 🎰");

			await betDone(interaction, interaction.user.id, initialAmount, amount);

			return await replyOk(interaction, [embed]);
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"slotmachine",
			[
				{
					name: "cantidad",
					required: true,
				},
			],
			["slot"]
		),
} as Command;
