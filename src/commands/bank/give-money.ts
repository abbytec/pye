import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, Users } from "../../Models/User.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { pyecoin } from "../../utils/constants.ts";
import { IUser } from "../../interfaces/IUser.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyWarning } from "../../utils/messages/replyWarning.ts";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.ts";
import { setCooldown } from "../../utils/cooldowns.ts";
import { ExtendedClient } from "../../client.ts";

const cooldown = 60 * 1000; // 1 minuto en milisegundos

export default {
	group: "🏦 - Finanzas del server (Casino)",
	data: new SlashCommandBuilder()
		.setName("give-money")
		.setDescription("Dale dinero a otra persona.")
		.addUserOption((option) => option.setName("usuario").setDescription("Usuario al que quieres transferir dinero.").setRequired(true))
		.addStringOption((option) => option.setName("cantidad").setDescription('Cantidad a transferir o "all".').setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("give-money", 60 * 1000), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const author = interaction.user;
			const targetUser = interaction.options.getUser("usuario", true);
			let cantidadInput = interaction.options.getString("cantidad", true);

			// Prevenir que el usuario se transfiera dinero a sí mismo
			if (targetUser.id === author.id) return await replyWarning(interaction, "No puedes darte dinero a ti mismo.");

			// Prevenir que se transfiera dinero a un bot
			if (targetUser.bot) return await replyWarning(interaction, "Los bots no pueden tener PyE Coins.");

			// Validar la cantidad
			let cantidad: number;
			let authorData: IUser | null = await getOrCreateUser(author.id);

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

			let targetData: Partial<IUser> | null = await getOrCreateUser(targetUser.id);

			// Realizar la transferencia
			authorData.cash -= cantidad;
			targetData.cash! += cantidad;

			await setCooldown(interaction.client as ExtendedClient, author.id, "give-money", Date.now() + cooldown);

			await Users.updateOne({ id: author.id }, { cash: authorData.cash });
			await Users.updateOne({ id: targetUser.id }, { cash: targetData.cash });

			return await replyOk(interaction, [
				new EmbedBuilder()
					.setAuthor({ name: author.tag, iconURL: author.displayAvatarURL() })
					.setDescription(`**${pyecoin} ${cantidad.toLocaleString()}** PyE Coins han sido transferidas a ${targetUser.toString()}.`)
					.setColor(0x00ff00)
					.setTimestamp(),
			]);
		},
		[]
	),
};
