import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Users } from "../../Models/User.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { pyecoin } from "../../utils/constants.ts";
import { IUser } from "../../interfaces/IUser.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyWarningToMessage } from "../../utils/finalwares/sendFinalMessages.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("withdraw")
		.setDescription("Saca dinero del banco.")
		.addStringOption((option) => option.setName("cantidad").setDescription('Cantidad a retirar o "all"').setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable> => {
			const user = interaction.user;

			let userData: Partial<IUser> | null = await Users.findOne({ id: user.id }).exec();
			if (!userData) userData = { id: user.id, cash: 0, bank: 0, total: 0 };
			await Users.create(userData);

			if (userData.bank! <= 0)
				return {
					reactWarningMessage: "No tienes suficientes PyE Coins para sacar del banco.",
				};

			const cantidadInput = interaction.options.getString("cantidad", true);
			let cantidad: number;

			if (cantidadInput.toLowerCase() === "all") {
				cantidad = userData.bank!;
			} else {
				if (!/^\d+$/gi.test(cantidadInput))
					return {
						reactWarningMessage: 'La cantidad que ingresaste no es válida.\nUso: `/withdraw [Cantidad | "all"]`',
					};
				cantidad = parseInt(cantidadInput, 10);
				if (isNaN(cantidad) || cantidad <= 0)
					return {
						reactWarningMessage: 'La cantidad que ingresaste no es válida.\nUso: `/withdraw [Cantidad | "all"]`',
					};
			}

			if (cantidad > userData.bank!)
				return {
					reactWarningMessage: "No tienes suficientes PyE Coins en tu banco para retirar.",
				};

			userData.bank! -= cantidad;
			userData.cash! += cantidad;

			await Users.updateOne({ id: user.id }, userData);

			return await replyOk(interaction, [
				new EmbedBuilder()
					.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
					.setDescription(`**${pyecoin} ${cantidad.toLocaleString()}** PyE Coins fueron sacadas del banco.`)
					.setColor(0xebae34)
					.setTimestamp(),
			]);
		},
		[replyWarningToMessage]
	),
};
