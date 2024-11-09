// src/commands/Currency/rob.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { newUser, Users } from "../../Models/User.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { checkQuestLevel, IQuest } from "../../utils/quest.ts";
import { IUser } from "../../interfaces/IUser.ts";
import { setCooldown } from "../../utils/cooldowns.ts";
import { getChannelFromEnv } from "../../utils/constants.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.ts";
import { ExtendedClient } from "../../client.ts";

const cooldownDuration = 5 * 60 * 60 * 1000;

export interface Rob {
	userId: string;
	lastTime: number;
	amount: number;
}

// Definición de los textos de éxito y fracaso
const successTexts: Array<(profit: string, user: string) => string> = [
	(profit, user) => `Te metiste en la casa de ${user} y viste unos queridos ${profit} monedas en la mesa.`,
	(profit, user) => `Estabas en el bus, intentaste robar y resultó que era ${user}. Al salir, recolectaste ${profit} monedas.`,
	(profit, user) => `En una forzosa pelea con ${user}, pudiste salir corriendo con su billetera y ${profit} monedas dentro.`,
];

const failureTexts: Array<(profit: string, user: string) => string> = [
	(profit, user) => `${user} llamó a la policía. Pagaste una multa por ${profit} monedas.`,
	(profit, user) =>
		`Estabas ebrio y no lo recordabas, sacaste una pistola y apuntaste a ${user} pero el atracador resultó atracado. Perdiste ${profit} monedas.`,
];

async function cooldownFunction(interaction: ChatInputCommandInteraction) {
	const user = interaction.user;
	let userData: Partial<IUser> | null = await Users.findOne({
		id: user.id,
	}).exec();
	if (!userData) userData = await newUser(user.id);

	if (["Ladron", "Ladrona"].includes(userData.profile?.job ?? "")) {
		return cooldownDuration / 2; // La mitad del cooldown
	}

	return cooldownDuration; // Cooldown completo
}

export default {
	data: new SlashCommandBuilder()
		.setName("rob")
		.setDescription("Gana (o pierde) dinero atracando.")
		.addUserOption((option) => option.setName("user").setDescription("El usuario al que deseas robar").setRequired(true)),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("rob", 5 * 60 * 60 * 1000, cooldownFunction),
			deferInteraction,
		],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener datos del usuario
			let userData: Partial<IUser> | null = await Users.findOne({
				id: user.id,
			}).exec();
			if (!userData) userData = await newUser(user.id);

			// Verificar si el usuario tiene un trabajo que le impide robar
			if (["Militar", "Policia"].includes(userData.profile?.job ?? ""))
				return await replyError(interaction, "No puedes robar, ¡es contra la ley!");

			// Obtener el usuario objetivo
			const targetUser = interaction.options.getUser("user", true);

			if (targetUser.id === user.id) return await replyError(interaction, "No puedes robarte dinero a ti mismo.");

			if (targetUser.bot) return await replyError(interaction, "Los bots no pueden tener monedas.");

			// Obtener datos del usuario objetivo
			let targetUserData: Partial<IUser> | null = await Users.findOne({
				id: targetUser.id,
			}).exec();
			if (!targetUserData) targetUserData = await newUser(targetUser.id);

			// Verificar si el usuario objetivo tiene dinero en efectivo
			if ((targetUserData.cash ?? 0) < 1) return await replyError(interaction, "No puedes robarle a alguien que no tiene dinero.");

			// Establecer el nuevo cooldown
			await setCooldown(interaction.client as ExtendedClient, user.id, "rob", cooldownDuration);

			// Calcular probabilidad de éxito
			let probability = (targetUserData.cash ?? 0) / ((targetUserData.cash ?? 0) + (userData.total ?? 0));
			probability = Math.max(0.2, Math.min(0.8, probability));

			let lose = Math.random() <= probability;

			// Si el usuario es ladrón, siempre tiene éxito
			if (["Ladron", "Ladrona"].includes(userData.profile?.job ?? "")) lose = false;

			// Calcular ganancia o pérdida
			let profit = Math.floor((1 - probability) * (targetUserData.cash ?? 0));

			// Si la ganancia es menor a 1, informar fracaso
			if (profit < 1)
				return await replyOk(
					interaction,
					`**Fracasaste** en el intento de robo a ${targetUser.toString()}, te vio y llamó a la policía. 🚔`
				);

			const profitFormatted = profit.toLocaleString();
			const targetUserMention = `<@${targetUser.id}>`;

			if (lose) {
				userData.cash = (userData.cash ?? 0) - profit;
				if (userData.cash < 0) userData.cash = 0;
			} else {
				userData.cash = (userData.cash ?? 0) + profit;
				targetUserData.cash = (targetUserData.cash ?? 0) - profit;
				if (targetUserData.cash < 0) targetUserData.cash = 0;
				(interaction.client as ExtendedClient).lastRobs.push({
					userId: user.id,
					lastTime: Date.now(),
					amount: profit,
				});
				// Actualizar misiones y otros datos
				try {
					await checkQuestLevel({
						msg: interaction,
						money: profit,
						userId: user.id,
					} as IQuest);
				} catch (error) {
					console.error("Error actualizando la quest:", error);
					// Puedes optar por manejar el error aquí
				}

				// Actualizar estadísticas de robo
				userData.rob = (userData.rob ?? 0) + profit;
			}

			// Guardar datos actualizados
			try {
				await Users.updateOne({ id: user.id }, userData).exec();
				await Users.updateOne({ id: targetUser.id }, targetUserData).exec();
			} catch (error) {
				console.error("Error actualizando los datos del usuario:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Seleccionar mensaje de éxito o fracaso
			const description = lose
				? failureTexts[Math.floor(Math.random() * failureTexts.length)](profitFormatted, targetUserMention)
				: successTexts[Math.floor(Math.random() * successTexts.length)](profitFormatted, targetUserMention);

			const embed = new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
				.setDescription(description)
				.setColor(lose ? 0xff7f7f : 0xebae34)
				.setTimestamp();

			await replyOk(interaction, [embed]);
		},
		[]
	),
};
