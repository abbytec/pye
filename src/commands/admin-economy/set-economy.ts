// src/commands/admin/set-economy.ts

import { SlashCommandBuilder, PermissionFlagsBits, SlashCommandSubcommandBuilder } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { CommandLimits, ICommandLimits } from "../../Models/Command.js";
import { replyError } from "../../utils/messages/replyError.js";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import ms from "ms"; // Importación de la librería ms
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import CommandService from "../../core/services/CommandService.js";

const payoutCommands = [
	{ name: "Work", value: "work" },
	{ name: "Rob", value: "rob" },
	{ name: "Slut", value: "slut" },
	{ name: "Crime", value: "crime" },
	// Agrega más comandos de economía según sea necesario
];

export default {
	group: "⚙️ - Administración de Economía",
	data: new SlashCommandBuilder()
		.setName("set-economy")
		.setDescription("Configura aspectos de los comandos de economía.")
		.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
			subcommand
				.setName("payout")
				.setDescription("Establece el rango de pago para un comando de economía.")
				.addStringOption((option) =>
					option
						.setName("comando")
						.setDescription("El comando de economía a configurar.")
						.setChoices(...payoutCommands)
						.setRequired(true)
				)
				.addIntegerOption((option) => option.setName("min").setDescription("Dinero mínimo a dar.").setRequired(true).setMinValue(0))
				.addIntegerOption((option) => option.setName("max").setDescription("Dinero máximo a dar.").setRequired(true).setMinValue(0))
		)
		.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
			subcommand
				.setName("failrate")
				.setDescription("Establece el porcentaje de fallo para un comando de economía.")
				.addStringOption((option) =>
					option
						.setName("comando")
						.setDescription("El comando de economía a configurar.")
						.setChoices(...payoutCommands)
						.setRequired(true)
				)
				.addIntegerOption((option) =>
					option.setName("porcentaje").setDescription("Porcentaje de fallo (0-100).").setRequired(true).setMinValue(0).setMaxValue(100)
				)
		)
		.addSubcommand((subcommand: SlashCommandSubcommandBuilder) =>
			subcommand
				.setName("cooldown")
				.setDescription("Establece el tiempo de espera de los comandos de economía.")
				.addStringOption((option) =>
					option
						.setName("comando")
						.setDescription("El comando de economía a configurar.")
						.setChoices(...payoutCommands)
						.setRequired(true)
				)
				.addStringOption((option) => option.setName("tiempo").setDescription("Tiempo de espera (ej. 1h, 20m, 1h30m).").setRequired(true))
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Solo administradores pueden usarlo

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const subcommand = interaction.options.getSubcommand(true);
			const commandName = interaction.options.getString("comando", true).toLowerCase();
			const user = interaction.user;

			// Definir logMessage una vez
			const logMessage: {
				channel: string;
				user: any;
				description: string;
				fields: { name: string; value: string; inline?: boolean }[];
			} = {
				channel: getChannelFromEnv("logs"),
				user,
				description: "",
				fields: [{ name: "Comando", value: `${commandName}`, inline: true }],
			};

			let result;

			switch (subcommand) {
				case "payout":
					result = await handlePayout(interaction, commandName, user, logMessage);
					break;
				case "failrate":
					result = await handleFailrate(interaction, commandName, user, logMessage);
					break;
				case "cooldown":
					result = await handleCooldown(interaction, commandName, user, logMessage);
					break;
				default:
					await replyError(
						interaction,
						"Subcomando no reconocido. Usa `/set-economy payout`, `/set-economy failrate` o `/set-economy cooldown`."
					);
					return;
			}

			if (!result) return;

			logMessage.fields.push({
				name: "Ejecutado por",
				value: `${user.tag} (${user.id})`,
				inline: false,
			});

			// Retornar logMessage si se ha configurado
			return { logMessages: [logMessage] };
		},
		[logMessages]
	),
} as Command;

// Handler for the 'payout' subcommand
async function handlePayout(
	interaction: IPrefixChatInputCommand,
	commandName: string,
	user: any,
	logMessage: {
		channel: string;
		user: any;
		description: string;
		fields: { name: string; value: string; inline?: boolean }[];
	}
) {
	const min = interaction.options.getInteger("min", true);
	const max = interaction.options.getInteger("max", true);

	// Validaciones
	if (min < 0) return await replyError(interaction, "El dinero mínimo a dar no puede ser menor a 0.");

	if (max < min) return await replyError(interaction, "El dinero máximo a dar no puede ser menor que el mínimo.");

	// Actualizar la base de datos
	await CommandLimits.findOneAndUpdate(
		{ name: commandName },
		{
			$set: {
				lowestMoney: min,
				highestMoney: max,
			},
		},
		{ new: true, upsert: true }
	).then((res: ICommandLimits) => CommandService.setCommandLimit(res));

	await replyOk(
		interaction,
		`Se ha establecido la paga del comando \`${commandName}\` de ${pyecoin} **${min}** a ${pyecoin} **${max}** PyE Coins.`
	);

	// Configurar logMessage
	logMessage.description = `**${user.tag}** ha establecido la paga del comando \`${commandName}\` de ${pyecoin} **${min}** a ${pyecoin} **${max}** PyE Coins.`;
	logMessage.fields.push({ name: "Dinero Mínimo", value: `${min}`, inline: true }, { name: "Dinero Máximo", value: `${max}`, inline: true });

	return { logMessages: [logMessage] };
}

// Handler for the 'failrate' subcommand
async function handleFailrate(
	interaction: IPrefixChatInputCommand,
	commandName: string,
	user: any,
	logMessage: {
		channel: string;
		user: any;
		description: string;
		fields: { name: string; value: string; inline?: boolean }[];
	}
) {
	const failRate = interaction.options.getInteger("porcentaje", true);

	// Validaciones
	if (failRate < 0 || failRate > 100) return await replyError(interaction, "El porcentaje de fallo debe estar entre 0 y 100.");

	// Actualizar la base de datos
	await CommandLimits.findOneAndUpdate({ name: commandName }, { $set: { failRate } }, { new: true, upsert: true }).then(
		(res: ICommandLimits) => CommandService.setCommandLimit(res)
	);

	await replyOk(interaction, `Se ha establecido el porcentaje de fallo del comando \`${commandName}\` a **${failRate}%**.`);

	// Configurar logMessage
	logMessage.description = `**${user.tag}** ha establecido el porcentaje de fallo del comando \`${commandName}\` a **${failRate}%**.`;
	logMessage.fields.push(
		{ name: "Comando", value: `${commandName}`, inline: true },
		{ name: "Porcentaje de Fallo", value: `${failRate}%`, inline: true }
	);

	return { logMessages: [logMessage] };
}

// Handler for the 'cooldown' subcommand
async function handleCooldown(
	interaction: IPrefixChatInputCommand,
	commandName: string,
	user: any,
	logMessage: {
		channel: string;
		user: any;
		description: string;
		fields: { name: string; value: string; inline?: boolean }[];
	}
) {
	const cooldownInput = interaction.options.getString("tiempo", true);

	const cooldownMs = ms(cooldownInput);
	if (cooldownMs === undefined || cooldownMs < 0)
		return await replyError(
			interaction,
			"El tiempo que ingresaste no es válido.\nUso: `/set-economy cooldown <comando> <tiempo (ej. 1h, 20m, 1h30m)>`"
		);

	// Convertir milisegundos a horas
	const cooldownHours = cooldownMs / 36e5;

	// Validar si el comando es de economía
	if (commandName === "rob") {
		await replyError(
			interaction,
			"El comando que ingresaste no es de economía.\nUso: `/set-economy cooldown <comando> <tiempo (ej. 1h, 20m, 1h30m)>`"
		);
		throw new Error("Invalid command for cooldown.");
	}

	// Actualizar el cooldown en la base de datos
	await CommandLimits.findOneAndUpdate({ name: commandName }, { $set: { cooldown: cooldownHours } }, { new: true, upsert: true }).then(
		(res: ICommandLimits) => CommandService.setCommandLimit(res)
	);

	await replyOk(
		interaction,
		`Se ha establecido el tiempo de espera para el comando \`${commandName}\` a **${ms(cooldownMs, {
			long: true,
		})}**.`
	);

	// Configurar logMessage
	logMessage.description = `**${user.tag}** ha establecido el tiempo de espera del comando \`${commandName}\` a **${ms(cooldownMs, {
		long: true,
	})}**.`;
	logMessage.fields.push({ name: "Tiempo de Espera", value: `${ms(cooldownMs, { long: true })}`, inline: true });

	return { logMessages: [logMessage] };
}
