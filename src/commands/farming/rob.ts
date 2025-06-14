// src/commands/Currency/rob.ts
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { IUser } from "../../interfaces/IUser.js";
import { setCooldown } from "../../utils/cooldowns.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { ExtendedClient } from "../../client.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import CommandService from "../../core/services/CommandService.js";

const cooldownDuration = 30 * 60 * 1000;

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

async function cooldownFunction(interaction: IPrefixChatInputCommand) {
	const user = interaction.user;
	let userData: Partial<IUser> = await getOrCreateUser(user.id);

	return cooldownCalculation(["Ladron", "Ladrona"].includes(userData.profile?.job ?? ""));
}

async function cooldownCalculation(isRobber: boolean) {
	if (isRobber) {
		return cooldownDuration / 2; // La mitad del cooldown
	}

	return cooldownDuration; // Cooldown completo
}

export default {
	group: "💰 - Farmeo de PyeCoins (Casino)",
	data: new SlashCommandBuilder()
		.setName("rob")
		.setDescription("Gana (o pierde) dinero atracando.")
		.addUserOption((option) => option.setName("user").setDescription("El usuario al que deseas robar").setRequired(true)),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("rob", cooldownDuration, cooldownFunction, false),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener datos del usuario
			let userData: Partial<IUser> = await getOrCreateUser(user.id);

			const negativeCash = (userData.cash ?? 0) < 0;

			// Verificar si el usuario tiene un trabajo que le impide robar
			if (["Militar", "Policia"].includes(userData.profile?.job ?? ""))
				return await replyError(interaction, "No puedes robar, ¡es contra la ley!");

			// Obtener el usuario objetivo
			const targetUser = await interaction.options.getUser("user", true);

			if (!targetUser) return;

			if (targetUser.id === user.id) return await replyError(interaction, "No puedes robarte dinero a ti mismo.");

			if (targetUser.bot) return await replyError(interaction, "Los bots no pueden tener monedas.");

			// Obtener datos del usuario objetivo
			let targetUserData: IUserModel = await getOrCreateUser(targetUser.id);

			// Verificar si el usuario objetivo tiene dinero en efectivo
			if ((targetUserData.cash ?? 0) < 1) return await replyError(interaction, "No puedes robarle a alguien que no tiene dinero.");

			// Establecer el nuevo cooldown
			await setCooldown(interaction.client, user.id, "rob", await cooldownFunction(interaction));

			// Calcular probabilidad de éxito
			let probability = targetUserData.cash / (targetUserData.cash + (userData.total ?? 0));
			probability = Math.max(0.2, Math.min(0.8, probability));

			let lose = Math.random() <= probability;

			// Si el usuario es ladrón, siempre tiene éxito
			if (["Ladron", "Ladrona"].includes(userData.profile?.job ?? "")) lose = false;

			// Calcular ganancia o pérdida
			let profit = Math.floor((1 - probability) * targetUserData.cash);

			// Si la ganancia es menor a 1, informar fracaso
			if (profit < 1)
				return await replyOk(
					interaction,
					`**Fracasaste** en el intento de robo a ${targetUser.toString()}, te vio y llamó a la policía. 🚔`
				);

			const targetUserMention = `<@${targetUser.id}>`;

			// Guardar datos actualizados
			try {
				if (lose) {
					await Users.updateOne({ id: userData.id }, { $inc: { cash: -profit } });
				} else {
					await Users.updateOne({ id: userData.id }, { $inc: { cash: profit, rob: profit } });
					await Users.updateOne({ id: targetUserData.id }, { $inc: { cash: -profit } });

					CommandService.lastRobs.push({
						userId: user.id,
						lastTime: Date.now(),
						amount: profit,
					});
					checkQuestLevel({
						msg: interaction,
						money: profit,
						userId: user.id,
					} as IQuest).catch(async (error) => {
						console.error("Error actualizando la quest:", error);
						await replyError(interaction, "Hubo un error al intentar actualizar los datos de quest.");
					});
				}
			} catch (error) {
				console.error("Error actualizando los datos del usuario:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Seleccionar mensaje de éxito o fracaso
			const profitFormatted = profit.toLocaleString();
			const description = lose
				? failureTexts[Math.floor(Math.random() * failureTexts.length)](profitFormatted, targetUserMention)
				: successTexts[Math.floor(Math.random() * successTexts.length)](profitFormatted, targetUserMention);

			const embed = new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
				.setDescription(description)
				.setColor(lose ? 0xff7f7f : 0xebae34)
				.setTimestamp();

			await replyOk(interaction, [embed], undefined, undefined, undefined, undefined, false);
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
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(client, "rob", [
			{
				name: "user",
				required: true,
			},
		]),
} as Command;
