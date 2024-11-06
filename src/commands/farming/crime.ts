// src/commands/Currency/crime.ts
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

// Definición de los textos de éxito
const texts: Array<(profit: string) => string> = [
	(profit) => `Asaltaste un Oxxo y solo pudiste robar ${profit} monedas antes de que llegara la policía 🚓.`,
	(profit) => `Robaste un banco 🐱‍👤 y lograste escapar con ${profit} monedas, ¡qué suerte!`,
	(profit) => `Le robaste el bolso a una abuelita y conseguiste ${profit} monedas.`,
	(profit) => `Robaste una caja misteriosa del Amazonas y sin saberlo encontraste ${profit} monedas.`,
	(profit) => `Te hiciste pasar por policía para robar una caja fuerte y lograste escapar con ${profit} monedas.`,
	(profit) => `Trabajaste en la mafia y por tu buen trabajo te pagaron ${profit} monedas.`,
	(profit) => `Fuiste de cazarrecompensas y ganaste ${profit} monedas.`,
];

// Definición de los textos de fracaso
const loss: Array<(profit: string) => string> = [
	(profit) => `Intentaste asaltar un Oxxo pero fuiste detenido 🚓 en el intento y tuviste que pagar ${profit} monedas.`,
	(profit) =>
		`Intentaste poner la leche antes que el cereal 🥛 pero fuiste arrestado por el horrible acto y tuviste que pagar ${profit} monedas.`,
	(profit) => `Intentaste robarle el bolso a una anciana pero fuiste detenido y tuviste que pagar ${profit} monedas para salir.`,
	(profit) => `En medio de un atraco con tus colegas intentaste escapar pero fuiste detenido y perdiste ${profit} monedas.`,
	(profit) =>
		`Te encontrabas en el Amazonas intentando robar una reliquia, pero fuiste capturado por una tribu y tuviste que pagarles ${profit} monedas para que te dejaran ir.`,
];

export default {
	data: new SlashCommandBuilder().setName("crime").setDescription("Gana (o pierde) dinero atracando."),

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

			// Definir rangos de ganancia y tasa de falla
			const lowestMoney = 100; // Ajusta estos valores según tus necesidades
			const highestMoney = 500;
			const failRate = 30; // Porcentaje de probabilidad de fallo

			// Generar ganancia aleatoria
			let profit = getRandomNumber(lowestMoney, highestMoney);

			// Determinar si el usuario pierde
			const lose = Math.random() <= failRate / 100;

			if (lose) {
				// El usuario pierde, deducir profit de su cash
				userData.cash = (userData.cash ?? 0) - profit;
				// Asegurarse de que el cash no sea negativo
				if (userData.cash < 0) {
					userData.cash = 0;
				}
			} else {
				// El usuario gana, ajustar profit por bonificaciones de trabajo
				const userJob = userData.profile?.job;
				const couples = userData.couples || [];

				if ((userJob === "Enfermero" || userJob === "Enfermera") && couples.some((s) => s.job === "Doctor" || s.job === "Doctora")) {
					profit += profit * 0.5;
				}

				if ((userJob === "Doctor" || userJob === "Doctora") && couples.some((s) => s.job === "Enfermero" || s.job === "Enfermera")) {
					profit += profit * 0.5;
				}

				profit = Math.floor(profit);
				userData.cash = (userData.cash ?? 0) + profit;
				userData.total = (userData.total ?? 0) + profit;

				try {
					await increaseHomeMonthlyIncome(user.id, profit);
					await checkQuestLevel({ msg: interaction, money: profit, userId: user.id } as IQuest);
				} catch (error) {
					console.error("Error actualizando la quest:", error);
					// Puedes manejar el error según sea necesario
				}
			}

			// Actualizar el usuario en la base de datos
			try {
				await Users.updateOne({ id: user.id }, userData).exec();
			} catch (error) {
				console.error("Error actualizando el usuario:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Formatear la ganancia
			const profitFormatted = profit.toLocaleString();

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
				.setColor(lose ? 0xff7f7f : 0x00ff00)
				.setTimestamp();

			// Establecer la descripción
			embed.setDescription(
				lose
					? loss[Math.floor(Math.random() * loss.length)](profitFormatted)
					: texts[Math.floor(Math.random() * texts.length)](profitFormatted)
			);

			// Enviar la respuesta
			await replyOk(interaction, [embed]);
		},
		[]
	),
};
