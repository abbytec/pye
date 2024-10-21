// src/commands/admin/set-economy.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits, SlashCommandSubcommandBuilder } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { logMessages } from "../../utils/finalwares/sendFinalMessages.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { Command } from "../../Models/Command.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";

const payoutCommands = [
	{
		name: "Work",
		value: "work",
	},
	{
		name: "Rob",
		value: "rob",
	},
	{
		name: "Slut",
		value: "slut",
	},
	{
		name: "Crime",
		value: "crime",
	},
];

export default {
	data: new SlashCommandBuilder()
		.setName("set-economy")
		.setDescription("Configura aspectos de los comandos de economía.")
		.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
			subcommand
				.setName("payout")
				.setDescription("Establece el rango de pago para un comando de economía.")
				.addStringOption((option) =>
					option.setName("comando").setDescription("El comando de economía a configurar.").setChoices(payoutCommands).setRequired(true)
				)
				.addIntegerOption((option) => option.setName("min").setDescription("Dinero mínimo a dar.").setRequired(true).setMinValue(0))
				.addIntegerOption((option) => option.setName("max").setDescription("Dinero máximo a dar.").setRequired(true).setMinValue(0))
		)
		.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
			subcommand
				.setName("failrate")
				.setDescription("Establece el porcentaje de fallo para un comando de economía.")
				.addStringOption((option) =>
					option.setName("comando").setDescription("El comando de economía a configurar.").setChoices(payoutCommands).setRequired(true)
				)
				.addIntegerOption((option) =>
					option.setName("porcentaje").setDescription("Porcentaje de fallo (0-100).").setRequired(true).setMinValue(0).setMaxValue(100)
				)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Solo administradores pueden usarlo

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("perms", "staff"), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const subcommand = interaction.options.getSubcommand(true);

			if (subcommand === "payout") {
				// Manejo del subcomando 'payout'
				const commandName = interaction.options.getString("comando", true).toLowerCase();
				const min = interaction.options.getInteger("min", true);
				const max = interaction.options.getInteger("max", true);

				// Validaciones
				if (min < 0) {
					return await replyError(interaction, "El dinero mínimo a dar no puede ser menor a 0.");
				}

				if (max < min) {
					return await replyError(interaction, "El dinero máximo a dar no puede ser menor que el mínimo.");
				}

				try {
					// Actualizar la base de datos
					await Command.updateOne(
						{ name: commandName },
						{
							$set: {
								lowestMoney: min,
								highestMoney: max,
							},
						},
						{ upsert: true }
					).exec();

					// Mensaje de confirmación
					const confirmationMessage = `Se ha establecido la paga del comando \`${commandName}\` de ${pyecoin} **${min}** a ${pyecoin} **${max}** PyE Coins.`;

					await replyOk(interaction, confirmationMessage);

					// Registrar en el canal de logs
					return {
						logMessages: [
							{
								channel: getChannelFromEnv("logs"),
								user: interaction.user,
								description: `**${interaction.user.tag}** ha establecido la paga del comando \`${commandName}\` de ${pyecoin} **${min}** a ${pyecoin} **${max}** PyE Coins.`,
								fields: [
									{ name: "Comando", value: `${commandName}`, inline: true },
									{ name: "Dinero Mínimo", value: `${min}`, inline: true },
									{ name: "Dinero Máximo", value: `${max}`, inline: true },
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
					console.error("Error al establecer la paga:", error);
					return await replyError(
						interaction,
						"Ocurrió un error al intentar establecer la paga. Por favor, intenta nuevamente más tarde."
					);
				}
			} else if (subcommand === "failrate") {
				// Manejo del subcomando 'failrate'
				const commandName = interaction.options.getString("comando", true).toLowerCase();
				const failRate = interaction.options.getInteger("porcentaje", true);

				// Validaciones
				if (failRate < 0 || failRate > 100) {
					return await replyError(interaction, "El porcentaje de fallo debe estar entre 0 y 100.");
				}

				try {
					// Actualizar la base de datos
					await Command.updateOne({ name: commandName }, { $set: { failRate } }, { upsert: true }).exec();

					// Mensaje de confirmación
					const confirmationMessage = `Se ha establecido el porcentaje de fallo del comando \`${commandName}\` a **${failRate}%**.`;

					await replyOk(interaction, confirmationMessage);

					// Registrar en el canal de logs
					return {
						logMessages: [
							{
								channel: getChannelFromEnv("logs"),
								user: interaction.user,
								description: `**${interaction.user.tag}** ha establecido el porcentaje de fallo del comando \`${commandName}\` a **${failRate}%**.`,
								fields: [
									{ name: "Comando", value: `${commandName}`, inline: true },
									{ name: "Porcentaje de Fallo", value: `${failRate}%`, inline: true },
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
					console.error("Error al establecer la tasa de fallo:", error);
					return await replyError(
						interaction,
						"Ocurrió un error al intentar establecer la tasa de fallo. Por favor, intenta nuevamente más tarde."
					);
				}
			} else {
				// Subcomando no reconocido
				return await replyError(interaction, "Subcomando no reconocido. Usa `/set-economy payout` o `/set-economy failrate`.");
			}
		},
		[logMessages]
	),
};
