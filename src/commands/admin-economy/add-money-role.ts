// src/commands/admin/add-money-role.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, Role } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { logMessages } from "../../utils/finalwares/sendFinalMessages.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { Users } from "../../Models/User.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("add-money-role")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDescription("Agrega dinero a todos los usuarios que tengan un rol específico.")
		.addRoleOption((option) => option.setName("rol").setDescription("El rol al que se le agregará el dinero.").setRequired(true))
		.addStringOption((option) =>
			option
				.setName("lugar")
				.setDescription("Lugar donde se agregará el dinero.")
				.setRequired(true)
				.addChoices({ name: "Cash", value: "cash" }, { name: "Bank", value: "bank" })
		)
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("Cantidad de PyE Coins a agregar.").setRequired(true).setMinValue(1)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Solo administradores pueden usarlo

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("perms", "staff"), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const role = interaction.options.getRole("rol", true) as Role;
			const place = interaction.options.getString("lugar", true).toLowerCase();
			const amount = interaction.options.getInteger("cantidad", true);

			// Validaciones
			if (!["cash", "bank"].includes(place)) {
				return await replyError(interaction, "Debes seleccionar un lugar válido (`cash` o `bank`).");
			}

			// Validar cantidad
			if (amount <= 0) {
				return await replyError(interaction, "La cantidad debe ser un número mayor a 0.");
			}

			// Obtener todos los miembros con el rol especificado
			const membersWithRole = role.members;

			if (membersWithRole.size === 0) {
				return await replyError(interaction, "No hay miembros con el rol especificado.");
			}

			try {
				// Extraer los IDs de los usuarios
				const userIds = [...membersWithRole.keys()];

				// Actualizar la base de datos para todos los usuarios con el rol
				await Users.updateMany({ id: { $in: userIds } }, { $inc: { [place]: amount } }, { upsert: true });

				// Mensaje de confirmación
				await replyOk(
					interaction,
					`Se han agregado ${pyecoin} **${amount.toLocaleString()}** PyE coins en \`${place}\` al rol ${role}.`
				);

				// Registrar en el canal de logs
				return {
					logMessages: [
						{
							channel: getChannelFromEnv("logs"),
							user: interaction.user,
							description: `**${
								interaction.user.tag
							}** ha agregado ${pyecoin} **${amount.toLocaleString()}** créditos en \`${place}\` al rol ${role}.`,
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
				console.error("Error al agregar dinero por rol:", error);
				return await replyError(
					interaction,
					"Ocurrió un error al intentar agregar dinero a los usuarios con el rol especificado. Por favor, intenta nuevamente más tarde."
				);
			}
		},
		[logMessages]
	),
};
