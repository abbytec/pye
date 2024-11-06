// src/commands/Currency/slut.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { Users } from "../../Models/User.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";

import { IUser } from "../../interfaces/IUser.ts";
import { increaseHomeMonthlyIncome } from "../../Models/Home.ts";
import { checkQuestLevel, IQuest } from "../../utils/quest.ts";
import { getRandomNumber } from "../../utils/generic.ts";
import { getChannelFromEnv } from "../../utils/constants.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";

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
	data: new SlashCommandBuilder().setName("slut").setDescription("Véndete para ganar dinero."),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener datos del usuario
			let userData: Partial<IUser> | null = await Users.findOne({ id: user.id }).exec();
			if (!userData) {
				userData = { id: user.id, cash: 0, bank: 0, total: 0, profile: undefined, couples: [] };
				await Users.create(userData);
			}

			// Definir rangos de ganancia
			const lowestMoney = 50; // Ajusta estos valores según tus necesidades
			const highestMoney = 300;

			// Generar ganancia aleatoria
			let profit = getRandomNumber(lowestMoney, highestMoney);

			// Determinar si el usuario pierde
			const failRate = 20; // Porcentaje de fallo, ajusta según tus necesidades
			const lose = Math.random() <= failRate / 100;

			let profitFormatted: string;

			if (lose) {
				userData.cash = (userData.cash ?? 0) - profit;
				userData.total = (userData.total ?? 0) - profit;
				profitFormatted = profit.toLocaleString();
			} else {
				// Ajustar ganancia según el trabajo del usuario y su pareja
				const userJob = userData.profile?.job;
				const couples = userData.couples || [];

				if ((userJob === "Enfermero" || userJob === "Enfermera") && couples.some((s) => s.job === "Doctor" || s.job === "Doctora")) {
					profit += profit * 0.5;
				}

				if ((userJob === "Doctor" || userJob === "Doctora") && couples.some((s) => s.job === "Enfermero" || s.job === "Enfermera")) {
					profit += profit * 0.5;
				}

				profit = Math.floor(profit);
				profitFormatted = profit.toLocaleString();

				// Actualizar el dinero del usuario
				userData.cash = (userData.cash ?? 0) + profit;
				userData.total = (userData.total ?? 0) + profit;
			}

			try {
				await Users.updateOne({ id: user.id }, userData).exec();
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

			if (!lose) {
				try {
					await increaseHomeMonthlyIncome(user.id, profit);
					await checkQuestLevel({ msg: interaction, money: profit, userId: user.id } as IQuest);
				} catch (error) {
					console.error("Error actualizando la quest:", error);
					// Opcional: puedes enviar una advertencia al usuario o simplemente registrar el error
				}
			}

			// No es necesario retornar nada adicional
		},
		[]
	),
};
