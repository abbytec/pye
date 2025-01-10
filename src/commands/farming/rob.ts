// src/commands/Currency/rob.ts
import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { IUser } from "../../interfaces/IUser.js";
import { setCooldown } from "../../utils/cooldowns.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { ExtendedClient } from "../../client.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";

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

	if (["Ladron", "Ladrona"].includes(userData.profile?.job ?? "")) {
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
			verifyCooldown("rob", cooldownDuration, cooldownFunction),
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
			await setCooldown(interaction.client, user.id, "rob", cooldownDuration);

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

			if (lose) {
				userData.cash = (userData.cash ?? 0) - profit;
			} else {
				targetUserData.cash = targetUserData.cash - profit;
				userData.cash = (userData.cash ?? 0) + profit;

				interaction.client.lastRobs.push({
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
					await replyError(interaction, "Hubo un error al intentar actualizar los datos de quest.");
				}

				// Actualizar estadísticas de robo
				userData.rob = (userData.rob ?? 0) + profit;
			}

			// Guardar datos actualizados
			try {
				await Users.updateOne({ id: user.id }, userData);
				await Users.updateOne({ id: targetUser.id }, targetUserData);
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
							content: `Por favor <@${user.id}>, recuerde que su saldo anterior era negativo. Puede compensarlo extrayendo dinero del banco mediante el comando /withdraw.`,
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
