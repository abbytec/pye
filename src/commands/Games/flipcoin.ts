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
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";

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
				.setRequired(false)
		),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("flipcoin", 3000),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			let side: string = interaction.options.getString("lado") ?? ["cara", "cruz"][Math.floor(Math.random() * 2)];
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
				.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
				.setDescription(`Ha salido \`${flipcoin}\` y ${flipcoin == side ? "ganaste" : "perdiste"} ${Math.abs(amount)}.`)
				.setColor(flipcoin != side ? COLORS.errRed : COLORS.okGreen);

			await replyOk(interaction, [embed]);

			if (flipcoin == side) {
				try {
					await increaseHomeMonthlyIncome(interaction.user.id, amount);
					await checkQuestLevel({ msg: interaction, money: amount, userId: interaction.user.id } as IQuest, true);
				} catch (error) {
					console.error("Error actualizando la quest:", error);
					await replyError(interaction, "Hubo un error al intentar actualizar los datos de quest.");
				}
			}
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
