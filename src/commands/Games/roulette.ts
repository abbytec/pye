import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel, Guild } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { increaseHomeMonthlyIncome } from "../../Models/Home.js";
import { IUserModel, getOrCreateUser, Users } from "../../Models/User.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { calculateJobMultiplier } from "../../utils/generic.js";
import { replyError } from "../../utils/messages/replyError.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
let data: {
	fin: number;
	apuestas: { jugador: string; cantidad: number; apuesta: string }[];
	intervalo?: NodeJS.Timeout;
	bola: { color: string; valor: number };
} = {
	fin: -1,
	apuestas: [],
	intervalo: undefined,
	bola: { color: "0", valor: 0 },
};
const rojos = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const negros = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35];
const colores = { red: "red", black: "black", green: "green", even: "even", odd: "odd" };

export default {
	group: "🎮 • Juegos",
	data: new SlashCommandBuilder()
		.setName("roulette")
		.setDescription("Inicia un juego de ruleta o coloca tu apuesta en un juego existente.")
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("la cantidad que quieres apostar (entre 100 y 1500)").setRequired(true)
		)
		.addStringOption((option) =>
			option
				.setName("eleccion")
				.setDescription("Rojo, negro, verde, par ó impar")
				.setChoices([
					{ name: "Rojo", value: "red" },
					{ name: "Negro", value: "black" },
					{ name: "Verde", value: "green" },
					{ name: "Par", value: "even" },
					{ name: "Impar", value: "odd" },
				])
				.setRequired(true)
		),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("roulette", 3000),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			let userData: IUserModel = await getOrCreateUser(interaction.user.id);
			let amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			let choice: string = interaction.options.getString("eleccion", true);
			// Validar datos
			if (amount < 100 || amount > 1500 || amount > userData.cash)
				return replyError(
					interaction,
					`Se ingresó una cantidad inválida, debe ser ${
						amount < 100 ? "mayor que 100" : "menor que 1500"
					} o no tienes suficiente dinero`
				);
			// Comenzar el juego
			if (data.fin == -1) {
				data.fin = Date.now() + 30e3;
				let apuestas: { jugador: string; cantidad: number; apuesta: any }[] = [];
				data.apuestas = apuestas;
				let intervalo: NodeJS.Timeout = setTimeout(() => {
					roulette(interaction);
				}, 30e3);
				data.intervalo = intervalo;
			}
			// Añadir apuestas
			data.apuestas?.push({ jugador: interaction.user.id, cantidad: amount, apuesta: choice });
			// Mensaje de respuesta del comando
			await replyInfo(
				interaction,
				`Tu apuesta (${amount}${pyecoin}, ${choice}) se realizó con éxito. Aún faltan ${Math.round(
					(data.fin - Date.now()) / 1000
				)} segundos para terminar.`
			);
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"roulette",
			[
				{
					name: "cantidad",
					required: true,
				},
				{
					name: "eleccion",
					required: true,
				},
			],
			["bj"]
		),
} as Command;

async function roulette(interaction: IPrefixChatInputCommand) {
	// Se ejecuta luego de 30s
	let msg = "";
	data.fin = -1;
	let valor = Math.floor(Math.random() * 36);
	let vcolor = colores.green;
	if (rojos.includes(valor)) {
		vcolor = colores.red;
	} else if (negros.includes(valor)) {
		vcolor = colores.black;
	}
	data.bola = { valor: valor, color: vcolor }; //En la ruleta saldrá un número del 1 al 24
	const resultados: { jugador: string; cantidad: number }[] = [];
	const bola = data.bola ?? {};

	for (const apuesta of data.apuestas) {
		// Verificar si el jugador acierta en su apuesta
		let initValue = apuesta.cantidad;
		if (bola.color === "green" && bola.color === apuesta.apuesta) apuesta.cantidad = apuesta.cantidad * 36;
		if (bola.color != "green" && apuesta.apuesta === bola.color) apuesta.cantidad = apuesta.cantidad * 2;
		if (apuesta.apuesta === colores.even && bola.valor % 2 === 0) apuesta.cantidad = apuesta.cantidad * 2;
		if (apuesta.apuesta === colores.odd && bola.valor % 2 === 1) apuesta.cantidad = apuesta.cantidad * 2;

		let userData: IUserModel = await getOrCreateUser(apuesta.jugador);
		if (initValue != apuesta.cantidad) {
			// si ganó el valor inicial es dintinto, evitamos volver a calcular si ganó
			apuesta.cantidad += calculateJobMultiplier(userData.profile?.job, apuesta.cantidad, userData.couples || []);
		} else {
			apuesta.cantidad = 0 - apuesta.cantidad;
		}
		const resultado = resultados.find((res) => res.jugador === apuesta.jugador);
		if (resultado) {
			resultado.cantidad += apuesta.cantidad;
		} else {
			resultados.push({ jugador: apuesta.jugador, cantidad: apuesta.cantidad });
		}
	}

	for (const resultado of resultados) {
		try {
			await Users.updateOne({ id: resultado.jugador }, { $inc: { cash: resultado.cantidad } });
		} catch (error) {
			console.error("Error actualizando el usuario:", error);
			const embed = new EmbedBuilder()
				.setAuthor({ name: "Ruleta" })
				.setDescription(`Hubo un error actualizando el monto de <@${resultado.jugador}>.`)
				.setThumbnail("https://media.discordapp.net/attachments/687397125793120288/917501566527868968/spin.gif")
				.setTimestamp();
			const canal = interaction.client.channels.cache.get(getChannelFromEnv("casinoPye")) as TextChannel | undefined;
			if (!canal) return;
			await canal.send({ embeds: [embed] });
		}

		if (resultado.cantidad < 0) {
			msg += `<@${resultado.jugador}> ha perdido ${pyecoin} **${Math.abs(resultado.cantidad).toLocaleString()}**.\n`;
		} else if (resultado.cantidad > 0) {
			msg += `<@${resultado.jugador}> ha ganado ${pyecoin} **${resultado.cantidad.toLocaleString()}**.\n`;
			try {
				await increaseHomeMonthlyIncome(resultado.jugador, resultado.cantidad);
				await checkQuestLevel({ msg: interaction, money: resultado.cantidad, userId: resultado.jugador } as IQuest);
			} catch (error) {
				console.error("Error actualizando la quest:", error);
			}
		} else {
			msg += `<@${resultado.jugador}> no ha perdido ${pyecoin}, sus pérdidas se cancelaron con sus ganancias.\n`;
		}
	}

	// Enviar mensaje al terminar los 30s
	(interaction.client.channels.cache.get(getChannelFromEnv("casinoPye")) as TextChannel | undefined)?.send({
		embeds: [
			new EmbedBuilder()
				.setAuthor({ name: "Ruleta", iconURL: (interaction.guild as Guild).iconURL() ?? undefined })
				.setDescription(`La bola ha caído en: **${bola.valor}**, \`${bola.color}\`.`)
				.addFields([{ name: "Resultados", value: msg }])
				.setColor(COLORS.okGreen)
				.setThumbnail("https://media.discordapp.net/attachments/687397125793120288/917501566527868968/spin.gif")
				.setTimestamp(),
		],
	});
}
