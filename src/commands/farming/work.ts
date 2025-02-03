// src/commands/Currency/work.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, Users } from "../../Models/User.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";

import { IUser } from "../../interfaces/IUser.js";
import { increaseHomeMonthlyIncome } from "../../Models/Home.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { calculateJobMultiplier, getRandomNumber } from "../../utils/generic.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { ExtendedClient } from "../../client.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";

// Definición de los textos de respuesta
const texts: Array<(profit: string) => string> = [
	(profit) => `El trabajo en equipo es esencial, te permite echarle la culpa al otro. Has ganado ${profit} monedas.`,
	(profit) => `No te quedes en la cama a menos que puedas ganar dinero en ella, saliste a cumplir tus labores y ganaste ${profit} monedas.`,
	(profit) => `A todos nos gusta el trabajo, pero cuando ya está hecho. Al terminar obtuviste ${profit} monedas.`,
	(profit) =>
		`Algunos dicen que el trabajo duro no ha matado a nadie, pero tú te dices ¿Por qué arriesgarse? Te vas contento con tus ${profit} monedas.`,
	(profit) => `No puedo parar de trabajar. Tendré toda la eternidad para descansar. Tus increíbles esfuerzos te dieron ${profit} monedas.`,
	(profit) => `Mira si el trabajo es malo que tuvieron que pagarte ${profit} monedas para que lo hagas.`,
	(profit) => `Si el trabajo es salud que trabajen los enfermos, hoy no fue un día muy productivo te dieron ${profit} monedas.`,
];

export default {
	group: "💰 - Farmeo de PyeCoins (Casino)",
	data: new SlashCommandBuilder().setName("work").setDescription("Trabaja para ganar dinero."),
	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("work", 36e5),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener datos del usuario
			let userData: Partial<IUser> = await getOrCreateUser(user.id);

			const negativeCash = (userData.cash ?? 0) < 0;

			// Definir rangos de ganancia
			let command = interaction.client.getCommandLimit("work") ?? {
				lowestMoney: 500,
				highestMoney: 1000,
				failRate: 55,
			};

			// Generar ganancia aleatoria
			let profit = getRandomNumber(
				command.lowestMoney * ExtendedClient.getInflationRate(),
				command.highestMoney * ExtendedClient.getInflationRate()
			);

			// Ajustar ganancia según el trabajo del usuario y su pareja
			profit = calculateJobMultiplier(userData.profile?.job, profit, userData.couples || [], false);

			profit = Math.floor(profit);
			const profitFormatted = profit.toLocaleString();

			// Actualizar el dinero del usuario
			userData.cash = (userData.cash ?? 0) + profit;
			userData.total = (userData.total ?? 0) + profit;

			try {
				await Users.updateOne({ id: user.id }, userData);
			} catch (error) {
				console.error("Error actualizando el usuario:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
				.setDescription(texts[Math.floor(Math.random() * texts.length)](profitFormatted))
				.setColor(COLORS.okGreen)
				.setTimestamp();

			await replyOk(interaction, [embed]);

			try {
				await increaseHomeMonthlyIncome(user.id, profit);
				await checkQuestLevel({ msg: interaction, money: profit, userId: user.id } as IQuest);
			} catch (error) {
				console.error("Error actualizando la quest:", error);
				await replyError(interaction, "Hubo un error al intentar actualizar los datos de quest.");
			}
			if (negativeCash)
				return {
					logMessages: [
						{
							channel: getChannelFromEnv("casinoPye"),
							content: `Por favor **${user.username}**, recuerde que su saldo anterior era negativo. Puede compensarlo extrayendo dinero del banco mediante el comando /withdraw.`,
						},
					],
				};
		},
		[logMessages]
	),
	prefixResolver: (client: ExtendedClient) => new PrefixChatInputCommand(client, "work", [], ["wk"]),
} as Command;
