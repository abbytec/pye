import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, Users } from "../../Models/User.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, pyecoin } from "../../utils/constants.js";
import { IUser } from "../../interfaces/IUser.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { setCooldown } from "../../utils/cooldowns.js";
import { ExtendedClient } from "../../client.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";

const cooldown = 60 * 1000; // 1 minuto en milisegundos

export default {
	group: "🏦 - Finanzas del server (Casino)",
	data: new SlashCommandBuilder()
		.setName("give-money")
		.setDescription("Dale dinero a otra persona.")
		.addUserOption((option) => option.setName("usuario").setDescription("Usuario al que quieres transferir dinero.").setRequired(true))
		.addStringOption((option) => option.setName("cantidad").setDescription('Cantidad a transferir o "all".').setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("give-money", cooldown, undefined, false), deferInteraction()],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const author = interaction.user;
			const targetUser = await interaction.options.getUser("usuario", true);
			const cantidadInput = interaction.options.getString("cantidad", true);

			if (!targetUser) return;

			// Prevenir que el usuario se transfiera dinero a sí mismo
			if (targetUser.id === author.id) return await replyWarning(interaction, "No puedes darte dinero a ti mismo.");

			// Prevenir que se transfiera dinero a un bot
			if (targetUser.bot) return await replyWarning(interaction, "Los bots no pueden tener PyE Coins.");

			// Validar la cantidad
			let cantidad: number;
			const authorData: IUser | null = await getOrCreateUser(author.id);

			if (cantidadInput.toLowerCase() === "all") {
				cantidad = authorData.cash!;
			} else {
				if (!/^\d+$/gi.test(cantidadInput))
					return await replyWarning(
						interaction,
						'La cantidad que ingresaste no es válida.\nUso: `/give-money [Usuario] [Cantidad | "all"]`'
					);

				cantidad = parseInt(cantidadInput, 10);
				if (isNaN(cantidad) || cantidad <= 0)
					return await replyWarning(
						interaction,
						'La cantidad que ingresaste no es válida.\nUso: `/give-money [Usuario] [Cantidad | "all"]`'
					);
			}
			// Verificar si el autor tiene suficiente dinero
			if (authorData.cash < cantidad)
				return await replyWarning(interaction, "No tienes suficientes PyE Coins en tu bolsillo para transferir.");

			await getOrCreateUser(targetUser.id); // asegura que el usuario destino exista

			await setCooldown(interaction.client, author.id, "give-money", cooldown);

			await Users.updateOne({ id: author.id }, { $inc: { cash: -cantidad } });
			await Users.updateOne({ id: targetUser.id }, { $inc: { cash: cantidad } });

			return await replyOk(interaction, [
				new EmbedBuilder()
					.setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() })
					.setDescription(`**${pyecoin} ${cantidad.toLocaleString()}** PyE Coins han sido transferidas a ${targetUser.toString()}.`)
					.setColor(COLORS.okGreen)
					.setTimestamp(),
			]);
		},
		[]
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"give-money",
			[
				{
					name: "usuario",
					required: true,
				},
				{
					name: "cantidad",
					required: true,
				},
			],
			["pay", "gm", "transfer"]
		),
} as Command;
