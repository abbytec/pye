import { SlashCommandBuilder, EmbedBuilder, TextChannel, Guild } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { IUserModel, getOrCreateUser, betDone } from "../../Models/User.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { calculateJobMultiplier } from "../../utils/generic.js";
import { replyError } from "../../utils/messages/replyError.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import EconomyService from "../../core/services/EconomyService.js";
import { ExtendedClient } from "../../client.js";

const data: {
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
	group: "🎮 - Juegos",
	data: new SlashCommandBuilder()
		.setName("roulette")
		.setDescription("Inicia un juego de ruleta o coloca tu apuesta en un juego existente.")
		.addIntegerOption((option) => option.setName("cantidad").setDescription(`la cantidad que quieres apostar`).setRequired(true))
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
			verifyCooldown("roulette", 1000),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const userData: IUserModel = await getOrCreateUser(interaction.user.id);
			const amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			const choice: string = interaction.options.getString("eleccion", true);
			// Validar datos
			if (amount < 100 || amount > EconomyService.getGameMaxCoins() || amount > userData.cash)
				return replyError(
					interaction,
					`Se ingresó una cantidad inválida, debe ser ${
						amount < 100 ? "como minimo 100" : `menor que ${EconomyService.getGameMaxCoins()}`
					} o no tienes suficiente dinero`
				);
			// Comenzar el juego
			if (data.fin == -1) {
				data.fin = Date.now() + 30e3;
				const apuestas: { jugador: string; cantidad: number; apuesta: any }[] = [];
				data.apuestas = apuestas;
				const intervalo: NodeJS.Timeout = setTimeout(() => {
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
			["roulete"]
		),
} as Command;

async function roulette(interaction: IPrefixChatInputCommand) {
	// Reiniciar el estado de la partida.
	data.fin = -1;
	const valor = Math.floor(Math.random() * 36); // Aseguramos valores de 0 a 36.
	let vcolor = colores.green;
	if (rojos.includes(valor)) {
		vcolor = colores.red;
	} else if (negros.includes(valor)) {
		vcolor = colores.black;
	}
	data.bola = { valor, color: vcolor };

	// Creamos un mapa para acumular resultados de cada jugador.
	// Cada entrada tendrá la forma: { totalApostado, neto }
	const resultadosPorJugador: Map<string, { totalApostado: number; neto: number }> = new Map();

	// Procesamos cada apuesta individualmente.
	for (const apuesta of data.apuestas) {
		// Se guarda el monto apostado en esta apuesta.
		const montoApostado = apuesta.cantidad;
		let gananciaBruta = 0; // Ganancia bruta sin incluir la apuesta inicial.

		// Calculamos el multiplicador según la apuesta.
		// Importante: si apuestas a "even" o "odd", nos aseguramos de excluir el 0.
		if (vcolor === "green" && apuesta.apuesta === "green") {
			gananciaBruta = montoApostado * 36 - montoApostado;
		} else if (apuesta.apuesta === vcolor && vcolor !== "green") {
			gananciaBruta = montoApostado * 2 - montoApostado;
		} else if (apuesta.apuesta === colores.even && valor !== 0 && valor % 2 === 0) {
			gananciaBruta = montoApostado * 2 - montoApostado;
		} else if (apuesta.apuesta === colores.odd && valor !== 0 && valor % 2 === 1) {
			gananciaBruta = montoApostado * 2 - montoApostado;
		} else {
			// En cualquier otro caso se pierde la apuesta.
			gananciaBruta = -montoApostado;
		}

		// Acumulamos los resultados por jugador.
		if (resultadosPorJugador.has(apuesta.jugador)) {
			const acumulado = resultadosPorJugador.get(apuesta.jugador)!;
			acumulado.totalApostado += montoApostado;
			acumulado.neto += gananciaBruta;
		} else {
			resultadosPorJugador.set(apuesta.jugador, {
				totalApostado: montoApostado,
				neto: gananciaBruta,
			});
		}
	}

	// Mensaje que se enviará al canal.
	let msg = "";

	// Ahora procesamos el resultado global por jugador y aplicamos el bono de forma única.
	for (const [jugador, { totalApostado, neto }] of resultadosPorJugador) {
		// Obtenemos la información del usuario.
		const userData: IUserModel = await getOrCreateUser(jugador);
		let resultadoFinal = neto;

		// Si el neto es positivo, aplicamos el bono una sola vez.
		if (neto > 0) {
			resultadoFinal = calculateJobMultiplier(userData.profile?.job, neto, userData.couples || []);
		}

		// Actualizamos al jugador.
		await betDone(interaction, jugador, totalApostado, resultadoFinal);

		// Construimos el mensaje.
		if (resultadoFinal < 0) {
			msg += `<@${jugador}> ha perdido ${pyecoin} **${Math.abs(resultadoFinal).toLocaleString()}**.\n`;
		} else if (resultadoFinal > 0) {
			msg += `<@${jugador}> ha ganado ${pyecoin} **${resultadoFinal.toLocaleString()}**.\n`;
		} else {
			msg += `<@${jugador}> no ha perdido ni ganado, sus apuestas se cancelaron.\n`;
		}
	}

	// Enviar mensaje al terminar los 30s
	(interaction.client.channels.cache.get(getChannelFromEnv("casinoPye")) as TextChannel | undefined)?.send({
		embeds: [
			new EmbedBuilder()
				.setAuthor({
					name: "Ruleta",
					iconURL: (interaction.guild as Guild).iconURL() ?? undefined,
				})
				.setDescription(`La bola ha caído en: **${valor}**, \`${vcolor}\`.`)
				.addFields([{ name: "Resultados", value: msg }])
				.setColor(COLORS.okGreen)
				.setThumbnail("https://media.discordapp.net/attachments/687397125793120288/917501566527868968/spin.gif")
				.setTimestamp(),
		],
	});
}
