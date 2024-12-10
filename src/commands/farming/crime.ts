// src/commands/Currency/crime.ts
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
	group: "💰 - Farmeo de PyeCoins (Casino)",
	data: new SlashCommandBuilder().setName("crime").setDescription("Gana (o pierde) dinero atracando."),
	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("crime", 18e5),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener datos del usuario
			let userData: Partial<IUser> | null = await getOrCreateUser(user.id);

			let command = interaction.client.getCommandLimit("crime") ?? {
				lowestMoney: 500,
				highestMoney: 1000,
				failRate: 55,
			};

			// Generar ganancia aleatoria
			let profit = getRandomNumber(command.lowestMoney, command.highestMoney);

			// Determinar si el usuario pierde
			const lose = Math.random() <= command.failRate / 100;

			if (lose) {
				// El usuario pierde, deducir profit de su cash
				userData.cash = (userData.cash ?? 0) - profit;
				// Asegurarse de que el cash no sea negativo
				if (userData.cash < 0) {
					profit += userData.cash;
					userData.cash = 0;
				}
			} else {
				// El usuario gana, ajustar profit por bonificaciones de trabajo
				profit = calculateJobMultiplier(userData.profile?.job, profit, userData.couples || []);

				profit = Math.floor(profit);
				userData.cash = (userData.cash ?? 0) + profit;

				try {
					await increaseHomeMonthlyIncome(user.id, profit);
					await checkQuestLevel({ msg: interaction, money: profit, userId: user.id } as IQuest);
				} catch (error) {
					console.error("Error actualizando la quest:", error);
					await replyError(interaction, "Hubo un error al actualizar los datos de quest.");
				}
			}

			// Actualizar el usuario en la base de datos
			try {
				await Users.updateOne({ id: user.id }, { $set: { cash: userData.cash } });
			} catch (error) {
				console.error("Error actualizando el usuario:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Formatear la ganancia
			const profitFormatted = profit.toLocaleString();

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
				.setColor(lose ? COLORS.errRed : COLORS.okGreen)
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
	prefixResolver: (client: ExtendedClient) => new PrefixChatInputCommand(client, "crime", []),
} as Command;
