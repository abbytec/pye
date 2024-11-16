// src/commands/Currency/work.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, Users } from "../../Models/User.ts";
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
import { ExtendedClient } from "../../client.ts";

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
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener datos del usuario
			let userData: Partial<IUser> = await getOrCreateUser(user.id);

			// Definir rangos de ganancia
			let command = (interaction.client as ExtendedClient).getCommandLimit("work") ?? {
				lowestMoney: 500,
				highestMoney: 1000,
				failRate: 55,
			};

			// Generar ganancia aleatoria
			let profit = getRandomNumber(command.lowestMoney, command.highestMoney);

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
				.setColor(0x00ff00)
				.setTimestamp();

			await replyOk(interaction, [embed]);

			try {
				await increaseHomeMonthlyIncome(user.id, profit);
				await checkQuestLevel({ msg: interaction, money: profit, userId: user.id } as IQuest);
			} catch (error) {
				console.error("Error actualizando la quest:", error);
				// Puedes optar por enviar una advertencia o simplemente registrar el error
			}
		},
		[]
	),
};
