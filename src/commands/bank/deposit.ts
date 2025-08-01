import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, pyecoin } from "../../utils/constants.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";

export default {
	group: "🏦 - Finanzas del server (Casino)",
	data: new SlashCommandBuilder()
		.setName("deposit")
		.setDescription("Guarda dinero en el banco.")
		.addStringOption((option) => option.setName("cantidad").setDescription('Cantidad a depositar o "all"').setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			const userData: IUserModel = await getOrCreateUser(user.id);

			if (userData.cash <= 0) return await replyWarning(interaction, "No tienes suficientes PyE Coins para guardar en el banco.");

			const cantidadInput = interaction.options.getString("cantidad", true);
			let cantidad: number;

			if (cantidadInput.toLowerCase() === "all") {
				cantidad = userData.cash;
			} else {
				if (!/^\d+$/gi.test(cantidadInput))
					return await replyWarning(interaction, 'La cantidad que ingresaste no es válida.\nUso: `/deposit [Cantidad | "all"]`');

				cantidad = parseInt(cantidadInput, 10);
				if (isNaN(cantidad) || cantidad <= 0)
					return await replyWarning(interaction, 'La cantidad que ingresaste no es válida.\nUso: `/deposit [Cantidad | "all"]`');
			}

			if (cantidad > userData.cash) return await replyWarning(interaction, "No tienes suficientes PyE Coins para depositar.");

			await Users.updateOne({ id: user.id }, { $inc: { cash: -cantidad, bank: cantidad } });

			return await replyOk(interaction, [
				new EmbedBuilder()
					.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
					.setDescription(`**${pyecoin} ${cantidad.toLocaleString()}** PyE Coins fueron guardadas en el banco.`)
					.setColor(COLORS.okGreen)
					.setTimestamp(),
			]);
		},
		[]
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"deposit",
			[
				{
					name: "cantidad",
					required: true,
				},
			],
			["dep"]
		),
} as Command;
