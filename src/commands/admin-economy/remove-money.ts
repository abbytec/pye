// src/commands/admin/remove-money.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { Users } from "../../Models/User.js";
import { replyError } from "../../utils/messages/replyError.js";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { replyOk } from "../../utils/messages/replyOk.js";

export default {
	group: "⚙️ - Administración de Economía",
	data: new SlashCommandBuilder()
		.setName("remove-money")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDescription("Remueve dinero de un usuario.")
		.addStringOption((option) =>
			option
				.setName("place")
				.setDescription("Lugar del que se removerá el dinero.")
				.setRequired(true)
				.addChoices({ name: "Cash", value: "cash" }, { name: "Bank", value: "bank" })
		)
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("Cantidad de PyE Coins a remover.").setRequired(true).setMinValue(1)
		)
		.addUserOption((option) => option.setName("usuario").setDescription("Usuario al que se le removerá el dinero.").setRequired(false))
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers), // Solo administradores pueden usarlo

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: ChatInputCommandInteraction) => {
			const place = interaction.options.getString("place", true).toLowerCase();
			const amount = interaction.options.getInteger("cantidad", true);
			const user = interaction.options.getUser("usuario") ?? interaction.user;

			// Validaciones
			if (!["cash", "bank"].includes(place)) return await replyError(interaction, "Debes seleccionar un lugar válido (`cash` o `bank`).");

			// Evitar que se remueva dinero a bots
			if (user.bot) return await replyError(interaction, "No puedes remover dinero a un bot.");

			// Validar cantidad
			if (amount <= 0) return await replyError(interaction, "La cantidad debe ser un número mayor a 0.");

			try {
				// Obtener el usuario de la base de datos
				const userData = await Users.findOne({ id: user.id });
				if (!userData) return await replyError(interaction, "El usuario no tiene registros en la base de datos.");

				// Verificar si el usuario tiene suficiente dinero en el lugar especificado
				if ((userData as any)[place] < amount)
					return await replyError(interaction, `El usuario no tiene suficientes ${pyecoin} en \`${place}\` para remover.`);

				// Actualizar la base de datos
				await Users.updateOne({ id: user.id }, { $inc: { [place]: -amount } });

				// Mensaje de confirmación
				const confirmationMessage = `Se han removido ${pyecoin} **${amount.toLocaleString()}** PyE coins de \`${place}\` a **${
					user.tag
				}**.`;

				await replyOk(interaction, confirmationMessage);

				// Registrar en el canal de logs
				return {
					logMessages: [
						{
							channel: getChannelFromEnv("logs"),
							user: interaction.user,
							description: `**${
								interaction.user.tag
							}** ha removido ${pyecoin} **${amount.toLocaleString()}** créditos de \`${place}\` a **${user.tag}**.`,
							fields: [
								{ name: "Usuario", value: `${user.tag} (${user.id})`, inline: true },
								{ name: "Lugar", value: `${place}`, inline: true },
								{ name: "Cantidad", value: `${amount}`, inline: true },
								{ name: "Ejecutado por", value: `${interaction.user.tag} (${interaction.user.id})`, inline: false },
							],
						},
					],
				};
			} catch (error) {
				console.error("Error al remover dinero:", error);
				return await replyError(interaction, "Ocurrió un error al intentar remover dinero. Por favor, intenta nuevamente más tarde.");
			}
		},
		[logMessages]
	),
};
