// src/commands/admin/remove-money-role.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, Role } from "discord.js";
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
		.setName("remove-money-role")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDescription("Remueve dinero a todos los usuarios que tengan un rol específico.")
		.addRoleOption((option) => option.setName("rol").setDescription("El rol al que se le removerá el dinero.").setRequired(true))
		.addStringOption((option) =>
			option
				.setName("lugar")
				.setDescription("Lugar desde donde se removerá el dinero.")
				.setRequired(true)
				.addChoices({ name: "Cash", value: "cash" }, { name: "Bank", value: "bank" })
		)
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("Cantidad de PyE Coins a remover.").setRequired(true).setMinValue(1)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Solo administradores pueden usarlo

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const role = await interaction.options.getRole("rol", true);
			const place = interaction.options.getString("lugar", true).toLowerCase();
			const amount = interaction.options.getInteger("cantidad", true);

			// Validaciones
			if (!["cash", "bank"].includes(place)) return await replyError(interaction, "Debes seleccionar un lugar válido (`cash` o `bank`).");

			// Validar cantidad
			if (amount <= 0) return await replyError(interaction, "La cantidad debe ser un número mayor a 0.");

			// Obtener todos los miembros con el rol especificado
			const membersWithRole = role.members;

			if (membersWithRole.size === 0) return await replyError(interaction, "No hay miembros con el rol especificado.");

			try {
				// Extraer los IDs de los usuarios
				const userIds = [...membersWithRole.keys()];

				// Actualizar la base de datos para todos los usuarios con el rol
				// Utilizamos $inc con un valor negativo para remover dinero
				await Users.updateMany({ id: { $in: userIds } }, { $inc: { [place]: -amount } }, { upsert: true });

				// Mensaje de confirmación
				const confirmationMessage = `Se han removido ${pyecoin} **${amount.toLocaleString()}** PyE coins en \`${place}\` al rol ${role}.`;

				await replyOk(interaction, confirmationMessage);

				// Registrar en el canal de logs
				return {
					logMessages: [
						{
							channel: getChannelFromEnv("logs"),
							user: interaction.user,
							description: `**${
								interaction.user.tag
							}** ha removido ${pyecoin} **${amount.toLocaleString()}** créditos en \`${place}\` al rol ${role}.`,
							fields: [
								{ name: "Rol", value: `${role.name} (${role.id})`, inline: true },
								{ name: "Lugar", value: `${place}`, inline: true },
								{ name: "Cantidad", value: `${amount}`, inline: true },
								{
									name: "Ejecutado por",
									value: `${interaction.user.tag} (${interaction.user.id})`,
									inline: false,
								},
							],
						},
					],
				};
			} catch (error) {
				console.error("Error al remover dinero por rol:", error);
				return await replyError(
					interaction,
					"Ocurrió un error al intentar remover dinero a los usuarios con el rol especificado. Por favor, intenta nuevamente más tarde."
				);
			}
		},
		[logMessages]
	),
} as Command;
