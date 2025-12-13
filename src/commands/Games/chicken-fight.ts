import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, getChannelFromEnv, serverCoinName } from "../../utils/constants.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { replyError } from "../../utils/messages/replyError.js";
import { betDone, getOrCreateUser, IUserModel } from "../../Models/User.js";
import { Shop } from "../../Models/Shop.js";
import { calculateJobMultiplier } from "../../utils/generic.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import EconomyService from "../../core/services/EconomyService.js";
import { ExtendedClient } from "../../client.js";
import { getSingleDataFromRedisCounter, incrRedisCounter, resetSingleRedisCounter } from "../../utils/redisCounters.js";

export default {
	group: "🎮 - Juegos",
	data: new SlashCommandBuilder()
		.setName("chicken-fight")
		.setDescription("Apuesta dinero metiendo tu pollo a una pelea 🐔.")
		.addIntegerOption((option) => option.setName("cantidad").setDescription(`la cantidad que quieres apostar`).setRequired(true)),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casino")),
			verifyCooldown("chicken-fight", 1000),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			const userData: IUserModel = await getOrCreateUser(interaction.user.id);

			// Verificar que el monto sea válido
			if (amount < 100 || amount > EconomyService.getGameMaxCoins() || amount > userData.cash)
				return await replyError(
					interaction,
					`Se ingresó una cantidad inválida, debe ser ${
						amount < 100 ? "como minimo 100" : `menor que ${EconomyService.getGameMaxCoins()}`
					} o no tienes suficiente dinero.`
				);

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
				return await replyError(interaction, "Necesitas comprar un pollo para ponerlo a pelear.");

			// Obtener nivel del pollo desde Redis
			let chickenLevel = await getSingleDataFromRedisCounter("chickenFightLevel", interaction.user.id);
			if (chickenLevel === 0) {
				chickenLevel = 49; // Nivel inicial si no existe
			}

			const win = Math.random() < chickenLevel / 100;
			const earn = win ? calculateJobMultiplier(userData.profile?.job, amount, userData.couples || []) : -amount;
			let retirementMessage: string | null = null;

			if (win) {
				await incrRedisCounter("chickenFightLevel", interaction.user.id);
			} else {
				// Lógica de retiro
				if (chickenLevel > 80 || chickenLevel < 25) {
					const chickenIndex = userData.inventory.findIndex((itemId) => itemId.equals(data._id));
					if (chickenIndex > -1) {
						userData.inventory.splice(chickenIndex, 1);
						await userData.save();
						await resetSingleRedisCounter("chickenFightLevel", interaction.user.id);

						if (chickenLevel > 80) {
							retirementMessage =
								"\n\nTu pollo ha luchado valientemente y se ha ganado un merecido descanso. \n\n~ Gracias por todo lo que lograste, fuiste mi mejor pollo. ~";
						} else {
							retirementMessage = "\n\nTu pollo ha decidido que las peleas no son para él y se te escapó. Has perdido tu pollo.";
						}
					}
				}
			}
			await betDone(interaction, interaction.user.id, amount, earn);

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
				.setDescription(
					`Tu pollo 🐔 (Nivel ${win ? chickenLevel + 1 : chickenLevel}) ha ${win ? "ganado" : "perdido"} la pelea y se te ${
						win ? "incrementaron" : "quitaron"
					} ${Math.abs(earn)} ${serverCoinName}.${retirementMessage ?? ""}`
				)
				.setColor(win ? COLORS.okGreen : COLORS.errRed)
				.setTimestamp();

			await replyOk(interaction, [embed]);
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"chicken-fight",
			[
				{
					name: "cantidad",
					required: true,
				},
			],
			["cf"]
		),
} as Command;
