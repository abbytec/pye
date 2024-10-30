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
import { ExtendedClient } from "../../client.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("give-money")
		.setDescription("Dale dinero a otra persona.")
		.addUserOption((option) => option.setName("usuario").setDescription("Usuario al que quieres transferir dinero.").setRequired(true))
		.addStringOption((option) => option.setName("cantidad").setDescription('Cantidad a transferir o "all".').setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable> => {
			const author = interaction.user;
			const targetUser = interaction.options.getUser("usuario", true);
			let cantidadInput = interaction.options.getString("cantidad", true);
			const client = interaction.client as ExtendedClient;

			// Prevenir que el usuario se transfiera dinero a sí mismo
			if (targetUser.id === author.id)
				return {
					reactWarningMessage: "No puedes darte dinero a ti mismo.",
				};

			// Prevenir que se transfiera dinero a un bot
			if (targetUser.bot)
				return {
					reactWarningMessage: "Los bots no pueden tener PyE Coins.",
				};

			// Evitar el uso del comando si está en cooldown
			const cooldownKey = `give-money-${author.id}`;
			const cooldown = 60 * 1000; // 1 minuto en milisegundos
			const now = Date.now();
			if (client.cooldowns.has(cooldownKey) && now < client.cooldowns.get(cooldownKey)!)
				return {
					reactWarningMessage: "No puedes usar el comando **1 minuto** después de haberlo usado.",
				};

			// Validar la cantidad
			let cantidad: number;
			let authorData: IUser | null = await Users.findOne({ id: author.id }).exec();
			if (!authorData) authorData = await Users.create({ id: author.id, cash: 0, bank: 0, total: 0 });

			if (cantidadInput.toLowerCase() === "all") {
				cantidad = authorData.cash!;
			} else {
				if (!/^\d+$/gi.test(cantidadInput))
					return {
						reactWarningMessage: 'La cantidad que ingresaste no es válida.\nUso: `/give-money [Usuario] [Cantidad | "all"]`',
					};

				cantidad = parseInt(cantidadInput, 10);
				if (isNaN(cantidad) || cantidad <= 0)
					return {
						reactWarningMessage: 'La cantidad que ingresaste no es válida.\nUso: `/give-money [Usuario] [Cantidad | "all"]`',
					};
			}
			// Verificar si el autor tiene suficiente dinero
			if (authorData.cash < cantidad)
				return {
					reactWarningMessage: "No tienes suficientes PyE Coins en tu bolsillo para transferir.",
				};

			let targetData: Partial<IUser> | null = await Users.findOne({ id: targetUser.id }).exec();
			if (!targetData) targetData = await Users.create({ id: targetUser.id, cash: 0, bank: 0, total: 0 });

			// Realizar la transferencia
			authorData.cash -= cantidad;
			targetData.cash! += cantidad;

			client.cooldowns.set(cooldownKey, now + cooldown);
			setTimeout(() => client.cooldowns.delete(cooldownKey), cooldown);

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
		[replyWarningToMessage]
	),
};
