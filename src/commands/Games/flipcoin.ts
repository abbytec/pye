import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { PostHandleable } from "../../types/middleware.js";
import { betDone, getOrCreateUser, IUserModel } from "../../Models/User.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { calculateJobMultiplier } from "../../utils/generic.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import EconomyService from "../../core/services/EconomyService.js";
import { ExtendedClient } from "../../client.js";
import { generateRandomBinary } from "../../security/randomNumberGeneration.js";

export default {
	group: "🎮 - Juegos",
	data: new SlashCommandBuilder()
		.setName("flipcoin")
		.setDescription("Tira la moneda y prueba tu suerte.")
		.addIntegerOption((option) => option.setName("cantidad").setDescription(`la cantidad que quieres apostar`).setRequired(true))
		.addStringOption((option) =>
			option
				.setName("lado")
				.setDescription("Cara ó cruz")
				.setChoices([
					{ name: "Cara", value: "cara" },
					{ name: "Cruz", value: "cruz" },
				])
				.setRequired(false)
		),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casino")),
			verifyCooldown("flipcoin", 1000),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			const side: string = interaction.options.getString("lado") ?? ["cara", "cruz"][generateRandomBinary()];
			const userData: IUserModel = await getOrCreateUser(interaction.user.id);

			if (amount < 100 || amount > EconomyService.getGameMaxCoins(2.5) || amount > userData.cash)
				return await replyError(
					interaction,
					`Se ingresó una cantidad inválida, debe ser ${
						amount < 100 ? "mayor que 100" : `menor que ${EconomyService.getGameMaxCoins(2.5)}`
					} o no tienes suficiente dinero`
				);

			const flipcoin = ["cara", "cruz"][generateRandomBinary()];
			const earn = flipcoin == side ? calculateJobMultiplier(userData.profile?.job, amount, userData.couples || []) : -amount;
			await betDone(interaction, interaction.user.id, amount, earn);

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
				.setDescription(`Ha salido \`${flipcoin}\` y ${flipcoin == side ? "ganaste" : "perdiste"} ${Math.abs(earn)}.`)
				.setColor(flipcoin != side ? COLORS.errRed : COLORS.okGreen);

			await replyOk(interaction, [embed]);
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"flipcoin",
			[
				{
					name: "cantidad",
					required: true,
				},
				{
					name: "lado",
					required: false,
				},
			],
			["fp"]
		),
} as Command;
