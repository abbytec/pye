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
	apuestaMin: number;
	apuestas: { jugador: string; cantidad: number }[];
	intervalo?: NodeJS.Timeout;
} = {
	fin: -1,
	apuestaMin: 0,
	apuestas: [],
	intervalo: undefined,
};

export default {
	group: "🎮 - Juegos",
	data: new SlashCommandBuilder()
		.setName("russian-roulette")
		.setDescription("Inicia un juego de ruleta o coloca tu apuesta en un juego existente.")
		.addIntegerOption((option) => option.setName("cantidad").setDescription("la cantidad que quieres apostar").setRequired(true)),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casino")),
			verifyCooldown("russian-roulette", 1000),
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const userData: IUserModel = await getOrCreateUser(interaction.user.id);
			const amount: number = Math.floor(interaction.options.getInteger("cantidad", true));
			// Validar datos
			if (amount <= 100 || amount > EconomyService.getGameMaxCoins() || amount > userData.cash)
				return replyError(
					interaction,
					`Se ingresó una cantidad inválida, debe ser ${
						amount < 100 ? "como minimo 100" : `menor que ${EconomyService.getGameMaxCoins()}`
					} o no tienes suficiente dinero`
				);
			// Comenzar el juego
			if (data.fin == -1) {
				data.fin = Date.now() + 30e3;
				const intervalo: NodeJS.Timeout = setTimeout(() => {
					russianRoulette(interaction);
				}, 30e3);
				data.intervalo = intervalo;
			}
			// Añadir apuestas si no están jugando ya
			const jugador = data.apuestas.find((apu) => apu.jugador === interaction.user.id);

			if (data.apuestas.length === 6) {
				return await replyError(interaction, `Ya hay 6 jugadores en la ruleta`);
			}

			if (!jugador) {
				if (amount >= data.apuestaMin) {
					data.apuestaMin = amount;
				} else {
					return await replyError(interaction, `No puedes apostar un monto menor a ${data.apuestaMin}`);
				}
				data.apuestas.push({ jugador: interaction.user.id, cantidad: amount });
			} else {
				return await replyError(interaction, "Ya te encuentras dentro del juego");
			}

			const remaining = Math.max(0, Math.round((data.fin - Date.now()) / 1000));
			return await replyInfo(
				interaction,
				`Tu apuesta (${amount}${pyecoin}) se realizó con éxito. Aún faltan ${remaining} segundos para comenzar.`
			);
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"russian-roulette",
			[
				{
					name: "cantidad",
					required: true,
				},
			],
			["rr"]
		),
} as Command;

async function russianRoulette(interaction: IPrefixChatInputCommand) {
	// 1. Verificación inicial
	if (!data.apuestas || !Array.isArray(data.apuestas) || data.apuestas.length === 0) {
		data.fin = -1;
		data.intervalo = undefined;
		return;
	}

	// 2. COPIAR EL ESTADO LOCALMENTE (Snapshot del juego actual)
	const apuestasActuales = [...data.apuestas];

	if (apuestasActuales.length == 1) {
		apuestasActuales.push({ jugador: process.env.CLIENT_ID ?? "", cantidad: apuestasActuales[0].cantidad });
	}

	// 3. RESETEAR EL ESTADO GLOBAL INMEDIATAMENTE
	data.apuestas = [];
	data.apuestaMin = 0;
	data.fin = -1;
	data.intervalo = undefined;

	// Lógica del juego
	const ganadorInfo = apuestasActuales[Math.floor(Math.random() * apuestasActuales.length)];
	const ganador = ganadorInfo.jugador;

	const canal = interaction.client.channels.cache.get(getChannelFromEnv("casino")) as TextChannel | undefined;
	if (!canal) return;

	// Obtener datos (esto puede tardar, pero ya liberamos el estado global)
	const userData: IUserModel = await getOrCreateUser(ganador);
	const pozo = apuestasActuales.reduce((a, b) => a + b.cantidad, 0);

	for (let i = 0; i < apuestasActuales.length; i++) {
		const apuestaActual = apuestasActuales[i]; // Usamos la variable local

		// Calcular resultado de cada jugador
		if (apuestaActual.jugador == process.env.CLIENT_ID) {
			if (ganador == apuestaActual.jugador) {
				await canal.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "Un vagabundo", iconURL: (interaction.guild as Guild).iconURL() ?? undefined })
							.setDescription(`\`Un vagabundo\` tiró del gatillo y sobrevivió!`)
							.setColor(COLORS.okGreen)
							.setThumbnail("https://cdn.discordapp.com/emojis/918275419902464091.png?size=96"),
					],
				});
			} else {
				await canal.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "Un vagabundo", iconURL: (interaction.guild as Guild).iconURL() ?? undefined })
							.setDescription(
								`\`Un vagabundo\` tiró del gatillo por ${i + 1}ª vez y no sobrevivió para contarla... <:rip:1402158100659703848>`
							)
							.setColor(COLORS.errRed)
							.setThumbnail("https://cdn.discordapp.com/emojis/770482910918082571.png?size=96"),
					],
				});
			}
			continue;
		}

		// Lógica de pagos
		await betDone(
			interaction,
			apuestaActual.jugador,
			apuestaActual.cantidad,
			ganador === apuestaActual.jugador
				? calculateJobMultiplier(userData.profile?.job, pozo - apuestaActual.cantidad, userData.couples || [])
				: -apuestaActual.cantidad
		);

		// Enviar mensajes (sin bloquear el inicio de un nuevo juego)
		if (ganador === apuestaActual.jugador) {
			await canal.send({
				embeds: [
					new EmbedBuilder()
						.setAuthor({
							name: interaction.guild?.members.resolve(ganador)?.user.tag || "Anónimo",
							iconURL: interaction.guild?.members.resolve(ganador)?.user.displayAvatarURL(),
						})
						.setDescription(`\`${interaction.guild?.members.resolve(ganador)?.user.tag}\` tiró del gatillo y sobrevivió !`)
						.setColor(COLORS.okGreen)
						.setThumbnail("https://cdn.discordapp.com/emojis/918275419902464091.png?size=96"),
				],
			});
		} else {
			await canal.send({
				embeds: [
					new EmbedBuilder()
						.setAuthor({
							name: interaction.guild?.members.resolve(apuestaActual.jugador)?.user.tag ?? "Anónimo",
							iconURL: interaction.guild?.members.resolve(apuestaActual.jugador)?.user.displayAvatarURL(),
						})
						.setDescription(
							`\`${interaction.guild?.members.resolve(apuestaActual.jugador)?.user.tag}\` tiró del gatillo por ${
								i + 1
							}ª vez y no sobrevivió para contarla... <:rip:1402158100659703848>`
						)
						.setColor(COLORS.errRed)
						.setThumbnail("https://cdn.discordapp.com/emojis/770482910918082571.png?size=96"),
				],
			});
		}
	}
}
