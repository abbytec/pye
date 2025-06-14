import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, pyecoin } from "../../utils/constants.js";
import { IUser } from "../../interfaces/IUser.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";

export default {
	group: "🏦 - Finanzas del server (Casino)",
	data: new SlashCommandBuilder()
		.setName("withdraw")
		.setDescription("Saca dinero del banco.")
		.addStringOption((option) => option.setName("cantidad").setDescription('Cantidad a retirar o "all"').setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			let userData: IUserModel = await getOrCreateUser(user.id);

			if (userData.bank <= 0) return await replyWarning(interaction, "No tienes suficientes PyE Coins para sacar del banco.");

			const cantidadInput = interaction.options.getString("cantidad", true);
			let cantidad: number;

			if (cantidadInput.toLowerCase() === "all") {
				cantidad = userData.bank!;
			} else {
				if (!/^\d+$/gi.test(cantidadInput))
					return await replyWarning(interaction, 'La cantidad que ingresaste no es válida.\nUso: `/withdraw [Cantidad | "all"]`');
				cantidad = parseInt(cantidadInput, 10);
				if (isNaN(cantidad) || cantidad <= 0)
					return await replyWarning(interaction, 'La cantidad que ingresaste no es válida.\nUso: `/withdraw [Número | "all"]`');
			}

			if (cantidad > userData.bank) return await replyWarning(interaction, "No tienes suficientes PyE Coins en tu banco para retirar.");

			await Users.updateOne({ id: user.id }, { $inc: { bank: -cantidad, cash: cantidad } });

			return await replyOk(interaction, [
				new EmbedBuilder()
					.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
					.setDescription(`**${pyecoin} ${cantidad.toLocaleString()}** PyE Coins fueron sacadas del banco.`)
					.setColor(COLORS.okGreen)
					.setTimestamp(),
			]);
		},
		[]
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"withdraw",
			[
				{
					name: "cantidad",
					required: true,
				},
			],
			["wd"]
		),
} as Command;
