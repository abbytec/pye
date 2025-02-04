import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { replyError } from "../../utils/messages/replyError.js";
import { betDone, getOrCreateUser, IUserModel } from "../../Models/User.js";
import { Shop } from "../../Models/Shop.js";
import { calculateJobMultiplier } from "../../utils/generic.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
const level = new Map();

export default {
	group: "🎮 • Juegos",
	data: new SlashCommandBuilder()
		.setName("chicken-fight")
		.setDescription("Apuesta dinero metiendo tu pollo a una pelea 🐔.")
		.addIntegerOption((option) => option.setName("cantidad").setDescription(`la cantidad que quieres apostar`).setRequired(true)),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("chicken-fight", 1000),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			let userData: IUserModel = await getOrCreateUser(interaction.user.id);

			// Verificar que el monto sea válido
			if (amount < 100 || amount > ExtendedClient.getGamexMaxCoins() || amount > userData.cash)
				return await replyError(
					interaction,
					`Se ingresó una cantidad inválida, debe ser ${
						amount < 100 ? "como minimo 100" : `menor que ${ExtendedClient.getGamexMaxCoins()}`
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

			// Calcular resultado según el nivel del pollo
			if (!level.has(interaction.user.id)) level.set(interaction.user.id, 49);
			const win = Math.random() < level.get(interaction.user.id) / 100 && level.get(interaction.user.id) < 80;
			const earn = win ? calculateJobMultiplier(userData.profile?.job, amount, userData.couples || []) : -amount;
			await betDone(interaction, interaction.user.id, amount, earn);
			if (win) level.set(interaction.user.id, level.get(interaction.user.id) + 1);

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
				.setDescription(
					`Tu pollo 🐔 ha ${win ? "ganado" : "perdido"} la pelea y se te ${win ? "incrementaron" : "quitaron"} ${Math.abs(
						earn
					)} PyE Coins.`
				)
				.setColor(win ? COLORS.errRed : COLORS.okGreen)
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
