// src/commands/Currency/slut.ts
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, Users } from "../../Models/User.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";

import { IUser } from "../../interfaces/IUser.js";
import { increaseHomeMonthlyIncome } from "../../Models/Home.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { calculateJobMultiplier, getRandomNumber } from "../../utils/generic.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { ExtendedClient } from "../../client.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import EconomyService from "../../core/services/EconomyService.js";
import CommandService from "../../core/services/CommandService.js";

// Definición de los textos de respuesta para éxito
const successTexts: Array<(profit: string) => string> = [
	(profit) => `Abriste tu onlyfans, después de vender fotos de patas 🦶 conseguiste ${profit} monedas.`,
	(profit) => `Usaste tus sentidos seductores para llegar a un trato con tus jefes 🤭 y lograste ganar ${profit} monedas.`,
	(profit) => `Trabajaste bailando en una cantina 😳 y recolectaste ${profit} monedas de propinas.`,
	(profit) => `Anduviste haciendo trabajitos en la calle a mitad de la noche 🌔 y obtuviste un total de ${profit} monedas.`,
	(profit) => `Te pagaron por ayudar con otra mano 🖐 en la movida 😳 y recibiste ${profit} monedas.`,
	(profit) => `Actuaste en una película para adultos y ganaste ${profit} monedas, debió ser cansado.`,
];

// Definición de los textos de respuesta para fallo
const failureTexts: Array<(profit: string) => string> = [
	(profit) => `Fuiste detenido por incumplir las normas de onlyfans y tuviste que pagar ${profit} monedas.`,
	(profit) => `Durante la movida, el jefe salió herido y tuviste que pagarle ${profit} monedas del hospital.`,
	(profit) => `Durante tu trabajo en el ||table-dance|| te pusiste tan borracho que armaste una pelea y te quitaron ${profit} monedas.`,
	(profit) => `Intentaste hacerle un trabajito a un detective del FBI 🕵️‍♂️ sin saberlo y te arrestó por lo que perdiste ${profit} monedas.`,
];

export default {
	group: "💰 - Farmeo de PyeCoins (Casino)",
	data: new SlashCommandBuilder().setName("slut").setDescription("Véndete para ganar dinero."),
	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("slut", 18e5),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener datos del usuario
			let userData: Partial<IUser> = await getOrCreateUser(user.id);

			const negativeCash = (userData.cash ?? 0) < 0;

			let command = CommandService.getCommandLimit("slut") ?? {
				lowestMoney: 500,
				highestMoney: 1000,
				failRate: 55,
			};

			// Generar ganancia aleatoria
			let profit = getRandomNumber(
				EconomyService.getInflatedRate(command.lowestMoney, 3),
				EconomyService.getInflatedRate(command.highestMoney, 3)
			);

			// Determinar si el usuario pierde
			const lose = Math.random() <= command.failRate / 100;

			let profitFormatted: string;

			if (lose) {
				userData.cash = (userData.cash ?? 0) - profit;
				profitFormatted = profit.toLocaleString();
			} else {
				// Ajustar ganancia según el trabajo del usuario y su pareja
				profit = calculateJobMultiplier(userData.profile?.job, profit, userData.couples || [], false);

				profit = Math.floor(profit);
				profitFormatted = profit.toLocaleString();

				// Actualizar el dinero del usuario
				userData.cash = (userData.cash ?? 0) + profit;
				increaseHomeMonthlyIncome(user.id, profit)
					.then(async () => await checkQuestLevel({ msg: interaction, money: profit, userId: user.id } as IQuest))
					.catch((error) => {
						console.error("Error actualizando la quest:", error);
						replyError(interaction, "Hubo un error al intentar actualizar los datos de Quest.");
					});
			}

			try {
				await Users.updateOne({ id: user.id }, userData);
			} catch (error) {
				console.error("Error actualizando el usuario:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
				.setDescription(
					lose
						? failureTexts[Math.floor(Math.random() * failureTexts.length)](profitFormatted)
						: successTexts[Math.floor(Math.random() * successTexts.length)](profitFormatted)
				)
				.setColor(lose ? 0xff7f7f : 0xebae34)
				.setTimestamp();

			await replyOk(interaction, [embed]);

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
	prefixResolver: (client: ExtendedClient) => new PrefixChatInputCommand(client, "slut", []),
} as Command;
