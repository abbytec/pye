// src/commands/admin/add-money.ts

import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { Users } from "../../Models/User.js";
import { replyError } from "../../utils/messages/replyError.js";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "⚙️ - Administración de Economía",
	data: new SlashCommandBuilder()
		.setName("add-money")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDescription("Agrega dinero a un usuario.")
		.addStringOption((option) =>
			option
				.setName("place")
				.setDescription("Lugar donde se agregará el dinero.")
				.setRequired(true)
				.addChoices({ name: "Cash", value: "cash" }, { name: "Bank", value: "bank" })
		)
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("Cantidad de PyE Coins a agregar.").setRequired(true).setMinValue(1)
		)
		.addUserOption((option) => option.setName("usuario").setDescription("Usuario al que se le agregará el dinero.").setRequired(false))
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers), // Solo administradores pueden usarlo

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const place = interaction.options.getString("place", true).toLowerCase();
			const amount = interaction.options.getInteger("cantidad", true);
			const user = (await interaction.options.getUser("usuario")) ?? interaction.user;

			// Validaciones
			if (!["cash", "bank"].includes(place)) return await replyError(interaction, "Debes seleccionar un lugar válido (`cash` o `bank`).");

			// Evitar que se añada dinero a bots
			if (user.bot) return await replyError(interaction, "No puedes añadir dinero a un bot.");

			// Validar cantidad
			if (amount <= 0) return await replyError(interaction, "La cantidad debe ser un número mayor a 0.");

			try {
				// Actualizar la base de datos
				await Users.updateOne({ id: user.id }, { $inc: { [place]: amount } }, { upsert: true });

				// Mensaje de confirmación
				await replyOk(
					interaction,
					`Se han agregado ${pyecoin} **${amount.toLocaleString()}** PyE coins en \`${place}\` a **${user.tag}**.`
				);

				// Registrar en el canal de logs
				return {
					logMessages: [
						{
							channel: getChannelFromEnv("logs"),
							user: interaction.user,
							description: `**${
								interaction.user.tag
							}** ha agregado ${pyecoin} **${amount.toLocaleString()}** créditos en \`${place}\` a **${user.tag}**.`,
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
				console.error("Error al agregar dinero:", error);
				return await replyError(interaction, "Ocurrió un error al intentar agregar dinero. Por favor, intenta nuevamente más tarde.");
			}
		},
		[logMessages]
	),
} as Command;
