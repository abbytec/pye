import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import ms from "ms";
import { Money } from "../../Models/Money.js";
import { replyError } from "../../utils/messages/replyError.js";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "⚙️ - Administración de Economía",
	data: new SlashCommandBuilder()
		.setName("set-money")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDescription("Establece el dinero que se gana en los canales de voz, texto o mediante el comando bump.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("voice")
				.setDescription("Establece la cantidad y el tiempo para canales de voz.")
				.addIntegerOption((option) =>
					option.setName("cantidad").setDescription("Cantidad de PyE Coins a establecer.").setRequired(true).setMinValue(1)
				)
				.addStringOption((option) =>
					option.setName("tiempo").setDescription("Tiempo en formato (ej. 1h, 20m, 1h30m).").setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("text")
				.setDescription("Establece la cantidad y el tiempo para canales de texto.")
				.addIntegerOption((option) =>
					option.setName("cantidad").setDescription("Cantidad de PyE Coins a establecer.").setRequired(true).setMinValue(1)
				)
				.addStringOption((option) =>
					option.setName("tiempo").setDescription("Tiempo en formato (ej. 1h, 20m, 1h30m).").setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("bump")
				.setDescription("Establece la cantidad para el comando bump.")
				.addIntegerOption((option) =>
					option.setName("cantidad").setDescription("Cantidad de PyE Coins a establecer.").setRequired(true).setMinValue(1)
				)
		)
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator), // Solo administradores pueden usarlo

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const subcommand = interaction.options.getSubcommand();
			const amount = interaction.options.getInteger("cantidad", true);
			let timeInput: string | null = null;
			let time = 0;
			let updateObj: any = {};
			let confirmationMessage = "";

			// Validaciones
			if (amount <= 0) return await replyError(interaction, "La cantidad debe ser un número mayor a 0.");

			switch (subcommand) {
				case "voice":
				case "text":
					timeInput = interaction.options.getString("tiempo", true);

					if (/^\d+$/.test(timeInput))
						return await replyError(interaction, "El formato de tiempo no es válido. Ejemplos válidos: `1h`, `20m`, `1h30m`.");

					time = ms(timeInput) || 0;
					if (time === 0) return await replyError(interaction, "El tiempo proporcionado no es válido.");

					updateObj = {
						[`${subcommand}.time`]: time,
						[`${subcommand}.coins`]: amount,
					};

					confirmationMessage = `Se han establecido ${pyecoin} **${amount.toLocaleString()}** créditos de ganancia en los canales de \`${subcommand}\` con un tiempo de **${ms(
						time,
						{ long: true }
					)}**.`;
					break;

				case "bump":
					updateObj = { bump: amount };
					confirmationMessage = `Se han establecido ${pyecoin} **${amount.toLocaleString()}** créditos de ganancia en el comando \`bump\`.`;
					break;

				default:
					return await replyError(interaction, "Subcomando no reconocido.");
			}

			try {
				await Money.updateOne({ _id: process.env.CLIENT_ID }, updateObj, { upsert: true });

				// Si tienes una función similar a this.client.voiceMoney()
				if (typeof (interaction.client as any).voiceMoney === "function") (interaction.client as any).voiceMoney();

				// Responder al usuario
				await replyOk(interaction, confirmationMessage);

				// Preparar campos para el log
				let fields = [{ name: "Cantidad PyE Coins", value: `${amount}`, inline: true }];
				if (subcommand !== "bump") fields.push({ name: "Tiempo (cooldown)", value: ms(time, { long: true }), inline: true });

				return {
					logMessages: [
						{
							channel: getChannelFromEnv("logs"),
							user: interaction.user,
							description: `**${interaction.user.tag}** ha establecido el farming de PyE coins para el tipo \`${subcommand}\`.`,
							fields,
						},
					],
				};
			} catch (error) {
				console.error("Error al actualizar el dinero:", error);
				return await replyError(
					interaction,
					"Ocurrió un error al intentar establecer el dinero. Por favor, intenta nuevamente más tarde."
				);
			}
		},
		[logMessages]
	),
} as Command;
