// src/utils/card-games/TrucoStrategy.ts
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Snowflake } from "discord.js";
import { GameRuntime } from "../GameRuntime.js";
import { Card, GameStrategy } from "./IGameStrategy.js";
import { DeckFactory } from "../DeckFactory.js";

/**
 * ────────────────────────────────────────────────────────────────
 *  Types & helpers
 * ────────────────────────────────────────────────────────────────
 */

type EnviteType = "envido" | "real-envido" | "falta-envido" | "truco" | "retruco" | "vale4";
type EnviteState = null | "pending" | "accepted" | "rejected";

interface TrucoMeta {
	/** Puntos acumulados por equipo/jugador */
	scores: number[];
	/** Cantidad de bazas ganadas en la mano actual por equipo/jugador */
	tricks: number[];
	/** Cartas jugadas en la baza actual */
	plays: { idx: number; card: Card }[];
	/** Historia de bazas completas */
	history: { idx: number; card: Card }[][];
	/** Quién empezó la mano (gana si todas las bazas son pardas) */
	starter: number;
	/** Primera baza fue parda */
	firstParda: boolean;

	// === Sistema de Envites ===
	/** Estado actual del truco (null, truco, retruco, vale4) */
	trucoLevel: null | "truco" | "retruco" | "vale4";
	/** Puntos en juego por el truco */
	trucoValue: number;
	/** Quién cantó el último envite de truco */
	trucoInitiator: number | null;
	/** Estado: esperando respuesta al truco */
	trucoState: EnviteState;

	/** Envidos cantados en orden */
	envidoChain: EnviteType[];
	/** Valor total del envido en juego */
	envidoValue: number;
	/** Quién cantó el último envido */
	envidoInitiator: number | null;
	/** Estado: esperando respuesta al envido */
	envidoState: EnviteState;
	/** Puntuaciones de envido calculadas (null si no se ha revelado) */
	envidoScores: (number | null)[];
	/** Si el envido ya fue resuelto en esta mano */
	envidoResolved: boolean;

	// === Control de flujo ===
	/** Se puede cantar envido (solo antes de jugar la primera carta) */
	canSingEnvido: boolean;
	/** Jugadores que se fueron al mazo */
	foldedPlayers: Set<number>;
	/** Esperando respuesta a algún envite */
	waitingResponse: boolean;
	/** Tipo de respuesta esperada */
	pendingResponseType: "envido" | "truco" | null;
	/** De quién se espera la respuesta */
	pendingRespondent: number | null;

	/** Mensajes de log para mostrar */
	messages: string[];
}

const MAX_SCORE = 30;
const TEAM_SCORE_LIMIT = 15; // Para juegos por equipos

// Ranking de Truco de mayor (14) a menor (1)
function trucoRank(card: Card): number {
	const { suit, value } = card;
	switch (value) {
		case 1:
			if (suit === "⚔️") return 14; // Ancho de espadas
			if (suit === "🌳") return 13; // Ancho de bastos
			return 8; // ases falsos (copas y oros)
		case 7:
			if (suit === "⚔️") return 12; // 7 de espadas
			if (suit === "🪙") return 11; // 7 de oros
			return 4; // 7 de copas/bastos
		case 3:
			return 10;
		case 2:
			return 9;
		case 12:
			return 7;
		case 11:
			return 6;
		case 10:
			return 5;
		case 6:
			return 3;
		case 5:
			return 2;
		case 4:
			return 1;
		default:
			return 0;
	}
}

function winnerOfPlay(a: Card, b: Card): 0 | 1 | -1 {
	const ra = trucoRank(a);
	const rb = trucoRank(b);
	if (ra === rb) return -1; // parda
	return ra > rb ? 0 : 1;
}

/** Calcula el envido de una mano (dos cartas más altas del mismo palo + 20) */
function calculateEnvido(hand: Card[]): number {
	const bySuit: { [suit: string]: number[] } = {};

	// Agrupar por palo
	for (const card of hand) {
		const val = card.value === 10 || card.value === 11 || card.value === 12 ? 0 : (card.value as number);
		if (!bySuit[card.suit]) bySuit[card.suit] = [];
		bySuit[card.suit].push(val);
	}

	let maxEnvido = 0;
	for (const suit in bySuit) {
		const cards = bySuit[suit];
		if (cards.length >= 2) {
			// Ordenar descendente
			cards.sort((a, b) => b - a);
			const envido = 20 + cards[0] + cards[1];
			maxEnvido = Math.max(maxEnvido, envido);
		} else if (cards.length === 1) {
			// Solo una carta del palo
			maxEnvido = Math.max(maxEnvido, cards[0]);
		}
	}

	return maxEnvido;
}

/**
 * ────────────────────────────────────────────────────────────────
 *  Truco Strategy Completo
 * ────────────────────────────────────────────────────────────────
 */
export default class TrucoStrategy implements GameStrategy<TrucoMeta> {
	readonly name = "Truco";
	readonly limits = { min: 2, max: 6 }; // 2, 4 o 6 jugadores
	readonly cardSet = "spanish";
	readonly teamBased = true;

	/* ------------------------------------------------------------
	 * Setup
	 * ---------------------------------------------------------- */
	async init(ctx: GameRuntime<TrucoMeta>) {
		this.#dealNewHand(ctx);
		await ctx.sendTable();
	}

	/* ------------------------------------------------------------
	 * Interacciones
	 * ---------------------------------------------------------- */
	async handleAction(ctx: GameRuntime<TrucoMeta>, uid: string, interaction: ButtonInteraction): Promise<void> {
		const pid = ctx.players.findIndex((p) => p.id === uid);
		if (pid === -1) {
			await interaction.reply({ content: "No formas parte de la partida", ephemeral: true });
			return;
		}

		const action = interaction.customId;

		// Verificar si el jugador se fue al mazo
		if (ctx.meta.foldedPlayers.has(pid)) {
			await interaction.reply({ content: "Ya te fuiste al mazo", ephemeral: true });
			return;
		}

		// === RESPUESTAS A ENVITES ===
		if (action === "quiero" || action === "no-quiero") {
			await this.#handleEnviteResponse(ctx, pid, interaction, action === "quiero");
			return;
		}

		// === IRSE AL MAZO ===
		if (action === "mazo") {
			await this.#handleMazo(ctx, pid, interaction);
			return;
		}

		// === CANTAR ENVIDO ===
		if (action === "envido" || action === "real-envido" || action === "falta-envido") {
			await this.#handleEnvidoCant(ctx, pid, interaction, action as EnviteType);
			return;
		}

		// === CANTAR TRUCO ===
		if (action === "truco" || action === "retruco" || action === "vale4") {
			await this.#handleTrucoCant(ctx, pid, interaction, action as EnviteType);
			return;
		}

		// === JUGAR CARTA ===
		if (action.startsWith("play_")) {
			await this.#handlePlayCard(ctx, pid, interaction);
			return;
		}

		await interaction.reply({ content: "Acción desconocida", ephemeral: true });
	}

	/* ------------------------------------------------------------
	 * Handlers individuales
	 * ---------------------------------------------------------- */

	async #handlePlayCard(ctx: GameRuntime<TrucoMeta>, pid: number, interaction: ButtonInteraction) {
		// Solo puede jugar el turno actual
		if (ctx.current.id !== ctx.players[pid].id) {
			await interaction.reply({ content: "⏳ Espera tu turno", ephemeral: true });
			return;
		}

		// No se puede jugar si hay un envite pendiente
		if (ctx.meta.waitingResponse) {
			await interaction.reply({ content: "⏳ Esperando respuesta al envite", ephemeral: true });
			return;
		}

		const idxInHand = Number(interaction.customId.split("_")[1]);
		const player = ctx.players[pid];
		const card = player.hand[idxInHand];
		if (!card) {
			await interaction.reply({ content: "Carta inválida", ephemeral: true });
			return;
		}

		// Después de jugar la primera carta, no se puede cantar envido
		if (ctx.meta.plays.length === 0 && ctx.meta.history.length === 0) {
			ctx.meta.canSingEnvido = false;
		}

		// Jugar carta
		player.hand.splice(idxInHand, 1);
		ctx.meta.plays.push({ idx: pid, card });
		ctx.meta.messages.push(`<@${player.id}> juega **${card.value} ${card.suit}**`);

		await interaction.deferUpdate();

		// Verificar si todos los jugadores activos jugaron
		const activePlayers = ctx.players.filter((_, i) => !ctx.meta.foldedPlayers.has(i));

		// Si todos jugaron una carta en esta baza, resolverla
		if (ctx.meta.plays.length === activePlayers.length) {
			await this.#resolveBaza(ctx);
		} else {
			// Avanzar al siguiente jugador activo
			this.#nextActiveTurn(ctx);
		}

		await ctx.refreshHand(ctx.players[pid].id);
		await ctx.refreshHand(ctx.current.id);
		await ctx.sendTable();
	}

	async #handleEnvidoCant(ctx: GameRuntime<TrucoMeta>, pid: number, interaction: ButtonInteraction, type: EnviteType) {
		// Verificar que se puede cantar envido
		if (!ctx.meta.canSingEnvido) {
			await interaction.reply({ content: "Ya no se puede cantar envido (ya se jugó una carta)", ephemeral: true });
			return;
		}

		if (ctx.meta.envidoResolved) {
			await interaction.reply({ content: "El envido ya fue resuelto en esta mano", ephemeral: true });
			return;
		}

		// El envido solo se puede cantar si es tu turno o hay un envido activo
		if (!ctx.meta.waitingResponse && ctx.current.id !== ctx.players[pid].id) {
			await interaction.reply({ content: "Solo puedes cantar envido en tu turno", ephemeral: true });
			return;
		}

		// Si hay un envite pendiente, solo puede responder quien debe responder
		if (ctx.meta.waitingResponse && ctx.meta.pendingRespondent !== pid) {
			await interaction.reply({ content: "No es tu turno de responder", ephemeral: true });
			return;
		}

		await interaction.deferUpdate();

		// Agregar a la cadena de envidos
		ctx.meta.envidoChain.push(type);
		ctx.meta.envidoInitiator = pid;

		// Calcular valor acumulado
		let addedValue = 0;
		if (type === "envido") addedValue = 2;
		else if (type === "real-envido") addedValue = 3;
		else if (type === "falta-envido") {
			// Falta envido: vale los puntos que le faltan al que va ganando para llegar a 30
			const maxScore = Math.max(...ctx.meta.scores);
			addedValue = MAX_SCORE - maxScore;
		}

		ctx.meta.envidoValue += addedValue;
		ctx.meta.messages.push(`<@${ctx.players[pid].id}> canta **${type.toUpperCase()}**! (${ctx.meta.envidoValue} pts en juego)`);

		// Marcar que se espera respuesta del oponente
		ctx.meta.waitingResponse = true;
		ctx.meta.pendingResponseType = "envido";
		ctx.meta.envidoState = "pending";

		// Determinar quién debe responder
		const team = ctx.players[pid].team ?? pid;
		const opponentTeam = team === 0 ? 1 : 0;
		const opponent = ctx.players.find((p, i) => (p.team ?? i) === opponentTeam && !ctx.meta.foldedPlayers.has(i));
		ctx.meta.pendingRespondent = opponent ? ctx.players.indexOf(opponent) : null;

		await ctx.sendTable();
	}

	async #handleTrucoCant(ctx: GameRuntime<TrucoMeta>, pid: number, interaction: ButtonInteraction, type: EnviteType) {
		// Verificar lógica de quién puede cantar qué
		if (type === "truco" && ctx.meta.trucoLevel !== null) {
			await interaction.reply({ content: "El truco ya fue cantado", ephemeral: true });
			return;
		}

		if (type === "retruco" && ctx.meta.trucoLevel !== "truco") {
			await interaction.reply({ content: "Primero debe cantarse truco", ephemeral: true });
			return;
		}

		if (type === "vale4" && ctx.meta.trucoLevel !== "retruco") {
			await interaction.reply({ content: "Primero debe cantarse retruco", ephemeral: true });
			return;
		}

		// Si hay un envite pendiente, solo puede responder quien debe responder
		if (ctx.meta.waitingResponse && ctx.meta.pendingRespondent !== pid) {
			await interaction.reply({ content: "No es tu turno de responder", ephemeral: true });
			return;
		}

		// Si no hay envite pendiente, solo puede cantar el que tiene el turno
		if (!ctx.meta.waitingResponse && ctx.current.id !== ctx.players[pid].id) {
			await interaction.reply({ content: "Solo puedes cantar truco en tu turno", ephemeral: true });
			return;
		}

		await interaction.deferUpdate();

		ctx.meta.trucoLevel = type === "truco" ? "truco" : type === "retruco" ? "retruco" : "vale4";
		ctx.meta.trucoInitiator = pid;

		// Calcular puntos en juego
		if (type === "truco") ctx.meta.trucoValue = 2;
		else if (type === "retruco") ctx.meta.trucoValue = 3;
		else if (type === "vale4") ctx.meta.trucoValue = 4;

		ctx.meta.messages.push(`<@${ctx.players[pid].id}> canta **${type.toUpperCase()}**! (${ctx.meta.trucoValue} pts en juego)`);

		// Marcar que se espera respuesta
		ctx.meta.waitingResponse = true;
		ctx.meta.pendingResponseType = "truco";
		ctx.meta.trucoState = "pending";

		// Determinar quién debe responder
		const team = ctx.players[pid].team ?? pid;
		const opponentTeam = team === 0 ? 1 : 0;
		const opponent = ctx.players.find((p, i) => (p.team ?? i) === opponentTeam && !ctx.meta.foldedPlayers.has(i));
		ctx.meta.pendingRespondent = opponent ? ctx.players.indexOf(opponent) : null;

		await ctx.sendTable();
	}

	async #handleEnviteResponse(ctx: GameRuntime<TrucoMeta>, pid: number, interaction: ButtonInteraction, accepts: boolean) {
		if (!ctx.meta.waitingResponse) {
			await interaction.reply({ content: "No hay envite pendiente", ephemeral: true });
			return;
		}

		if (ctx.meta.pendingRespondent !== pid) {
			await interaction.reply({ content: "No es tu turno de responder", ephemeral: true });
			return;
		}

		await interaction.deferUpdate();

		if (ctx.meta.pendingResponseType === "envido") {
			if (accepts) {
				ctx.meta.messages.push(`<@${ctx.players[pid].id}> dice **QUIERO!**`);
				ctx.meta.envidoState = "accepted";
				// Resolver envido
				await this.#resolveEnvido(ctx);
			} else {
				ctx.meta.messages.push(`<@${ctx.players[pid].id}> dice **NO QUIERO**`);
				ctx.meta.envidoState = "rejected";
				// El que cantó gana 1 punto
				const initiatorTeam = ctx.players[ctx.meta.envidoInitiator!].team ?? ctx.meta.envidoInitiator!;
				ctx.meta.scores[initiatorTeam] += 1;
				ctx.meta.messages.push(`Equipo ${initiatorTeam + 1} gana **1 punto** por el envido rechazado`);
				ctx.meta.envidoResolved = true;
			}
			ctx.meta.waitingResponse = false;
			ctx.meta.pendingResponseType = null;
			ctx.meta.pendingRespondent = null;
		} else if (ctx.meta.pendingResponseType === "truco") {
			if (accepts) {
				ctx.meta.messages.push(`<@${ctx.players[pid].id}> dice **QUIERO!**`);
				ctx.meta.trucoState = "accepted";
				ctx.meta.waitingResponse = false;
				ctx.meta.pendingResponseType = null;
				ctx.meta.pendingRespondent = null;
			} else {
				ctx.meta.messages.push(`<@${ctx.players[pid].id}> dice **NO QUIERO**`);
				ctx.meta.trucoState = "rejected";
				// El que cantó gana 1 punto y termina la mano
				const initiatorTeam = ctx.players[ctx.meta.trucoInitiator!].team ?? ctx.meta.trucoInitiator!;
				ctx.meta.scores[initiatorTeam] += 1;
				ctx.meta.messages.push(`Equipo ${initiatorTeam + 1} gana **1 punto** por el truco rechazado`);

				await ctx.sendTable();
				await new Promise((r) => setTimeout(r, 3000));

				// Verificar fin de partida
				if (await this.#checkGameEnd(ctx)) return;

				// Repartir nueva mano
				const nextStarter = (ctx.meta.starter + 1) % ctx.players.length;
				this.#dealNewHand(ctx, nextStarter);
				await ctx.sendTable();
				return;
			}
		}

		await ctx.sendTable();
	}

	async #handleMazo(ctx: GameRuntime<TrucoMeta>, pid: number, interaction: ButtonInteraction) {
		await interaction.deferUpdate();

		ctx.meta.foldedPlayers.add(pid);
		ctx.meta.messages.push(`<@${ctx.players[pid].id}> se va al **MAZO**`);

		// Si todos los jugadores de un equipo se fueron al mazo, el otro equipo gana
		const team = ctx.players[pid].team ?? pid;
		const teamPlayers = ctx.players.filter((p) => (p.team ?? ctx.players.indexOf(p)) === team);
		const allFolded = teamPlayers.every((p) => ctx.meta.foldedPlayers.has(ctx.players.indexOf(p)));

		if (allFolded) {
			const opponentTeam = team === 0 ? 1 : 0;
			// Ganan los puntos del truco si estaba cantado, sino 1 punto
			const points = ctx.meta.trucoState === "accepted" ? ctx.meta.trucoValue : 1;
			ctx.meta.scores[opponentTeam] += points;
			ctx.meta.messages.push(`Equipo ${opponentTeam + 1} gana **${points} punto(s)** porque el equipo contrario se fue al mazo`);

			await ctx.sendTable();
			await new Promise((r) => setTimeout(r, 3000));

			if (await this.#checkGameEnd(ctx)) return;

			const nextStarter = (ctx.meta.starter + 1) % ctx.players.length;
			this.#dealNewHand(ctx, nextStarter);
		} else {
			// Si es el turno del que se fue al mazo, avanzar
			if (ctx.current.id === ctx.players[pid].id) {
				this.#nextActiveTurn(ctx);
			}
		}

		await ctx.sendTable();
	}

	async #resolveBaza(ctx: GameRuntime<TrucoMeta>) {
		ctx.meta.history.push([...ctx.meta.plays]);

		// Determinar ganador de la baza (por equipos si aplica)
		let winnerIdx = -1;
		if (ctx.meta.plays.length === 2) {
			const [first, second] = ctx.meta.plays;
			const winnerRel = winnerOfPlay(first.card, second.card);
			if (winnerRel !== -1) {
				winnerIdx = ctx.meta.plays[winnerRel].idx;
			} else {
				// Parda
				if (ctx.meta.history.length === 1) ctx.meta.firstParda = true;
				winnerIdx = first.idx; // El primero empieza la siguiente
			}
		} else {
			// Múltiples jugadores: encontrar el ganador
			let bestIdx = 0;
			let bestRank = trucoRank(ctx.meta.plays[0].card);
			let isParda = false;

			for (let i = 1; i < ctx.meta.plays.length; i++) {
				const rank = trucoRank(ctx.meta.plays[i].card);
				if (rank > bestRank) {
					bestRank = rank;
					bestIdx = i;
					isParda = false;
				} else if (rank === bestRank) {
					isParda = true;
				}
			}

			if (!isParda) {
				winnerIdx = ctx.meta.plays[bestIdx].idx;
			} else {
				// Parda en juegos de múltiples jugadores
				if (ctx.meta.history.length === 1) ctx.meta.firstParda = true;
				winnerIdx = ctx.meta.plays[0].idx;
			}
		}

		const winnerTeam = ctx.players[winnerIdx].team ?? winnerIdx;
		ctx.meta.tricks[winnerTeam]++;
		ctx.meta.messages.push(`<@${ctx.players[winnerIdx].id}> gana la baza (${ctx.meta.tricks[winnerTeam]}/2)`);

		// La próxima baza la empieza el ganador
		ctx.turnIndex = winnerIdx;
		ctx.meta.plays = [];

		// Verificar fin de mano
		await this.#checkHandEnd(ctx);
	}

	async #checkHandEnd(ctx: GameRuntime<TrucoMeta>) {
		let roundWinnerTeam: number = -1;

		// Alguien ganó 2 bazas
		roundWinnerTeam = ctx.meta.tricks.findIndex((t) => t >= 2);

		// Si la primera fue parda, la segunda decide
		if (roundWinnerTeam === -1 && ctx.meta.firstParda && ctx.meta.history.length >= 2) {
			const second = ctx.meta.history[1];
			if (second.length >= 2) {
				const winnerRel = winnerOfPlay(second[0].card, second[1].card);
				if (winnerRel !== -1) {
					const winnerIdx = second[winnerRel].idx;
					roundWinnerTeam = ctx.players[winnerIdx].team ?? winnerIdx;
				}
			}
		}

		// Si nadie llegó a 2 y no quedan cartas, gana quien empezó
		const allPlayersNoCards = ctx.players.every((p) => p.hand.length === 0 || ctx.meta.foldedPlayers.has(ctx.players.indexOf(p)));
		if (roundWinnerTeam === -1 && allPlayersNoCards) {
			roundWinnerTeam = ctx.players[ctx.meta.starter].team ?? ctx.meta.starter;
		}

		if (roundWinnerTeam !== -1) {
			// Calcular puntos a otorgar
			const points = ctx.meta.trucoState === "accepted" ? ctx.meta.trucoValue : 1;
			ctx.meta.scores[roundWinnerTeam] += points;
			ctx.meta.messages.push(`🏆 Equipo ${roundWinnerTeam + 1} gana la mano (**${points} punto(s)**)`);

			await ctx.sendTable();
			await new Promise((r) => setTimeout(r, 3000));

			if (await this.#checkGameEnd(ctx)) return;

			// Nueva mano
			const nextStarter = (ctx.meta.starter + 1) % ctx.players.length;
			this.#dealNewHand(ctx, nextStarter);
			await ctx.sendTable();
		}
	}

	async #checkGameEnd(ctx: GameRuntime<TrucoMeta>): Promise<boolean> {
		const winLimit = ctx.strategy.teamBased ? TEAM_SCORE_LIMIT : MAX_SCORE;
		const winnerTeam = ctx.meta.scores.findIndex((s) => s >= winLimit);

		if (winnerTeam !== -1) {
			const teamPlayers = ctx.players.filter((p, i) => (p.team ?? i) === winnerTeam);
			const names = teamPlayers.map((p) => p.displayName).join(" y ");
			await ctx.sendTable();
			ctx.finish(names, teamPlayers[0].id, winnerTeam);
			return true;
		}
		return false;
	}

	async #resolveEnvido(ctx: GameRuntime<TrucoMeta>) {
		// Calcular envido de todos los jugadores
		for (let i = 0; i < ctx.players.length; i++) {
			const envido = calculateEnvido(ctx.players[i].hand);
			ctx.meta.envidoScores[i] = envido;
		}

		// Determinar ganador por equipo
		const teamEnvidos: { [team: number]: number } = {};
		for (let i = 0; i < ctx.players.length; i++) {
			if (ctx.meta.foldedPlayers.has(i)) continue;
			const team = ctx.players[i].team ?? i;
			const envido = ctx.meta.envidoScores[i]!;
			if (!teamEnvidos[team] || envido > teamEnvidos[team]) {
				teamEnvidos[team] = envido;
			}
		}

		// Mostrar envidos
		for (let i = 0; i < ctx.players.length; i++) {
			if (!ctx.meta.foldedPlayers.has(i)) {
				ctx.meta.messages.push(`<@${ctx.players[i].id}> tiene **${ctx.meta.envidoScores[i]}** de envido`);
			}
		}

		// Determinar equipo ganador
		let winnerTeam = -1;
		let maxEnvido = -1;
		for (const team in teamEnvidos) {
			if (teamEnvidos[team] > maxEnvido) {
				maxEnvido = teamEnvidos[team];
				winnerTeam = Number(team);
			}
		}

		if (winnerTeam !== -1) {
			ctx.meta.scores[winnerTeam] += ctx.meta.envidoValue;
			ctx.meta.messages.push(`🏆 Equipo ${winnerTeam + 1} gana el envido (**${ctx.meta.envidoValue} punto(s)**)`);
		}

		ctx.meta.envidoResolved = true;
	}

	#nextActiveTurn(ctx: GameRuntime<TrucoMeta>) {
		let attempts = 0;
		do {
			ctx.nextTurn();
			attempts++;
		} while (ctx.meta.foldedPlayers.has(ctx.turnIndex) && attempts < ctx.players.length);
	}

	/* ------------------------------------------------------------
	 * UI y estado público
	 * ---------------------------------------------------------- */
	publicState(ctx: GameRuntime<TrucoMeta>) {
		let output = "";

		// Mensajes recientes (filtrar los que muestran cartas jugadas, ya que están en Mesa)
		if (ctx.meta.messages.length > 0) {
			const recentMessages = ctx.meta.messages
				.filter((msg) => !msg.includes("juega **"))
				.slice(-5);
			if (recentMessages.length > 0) {
				output += "**Últimas acciones:**\n" + recentMessages.join("\n") + "\n\n";
			}
		}

		// Estado de envites
		if (ctx.meta.trucoLevel) {
			output += `🎲 **${ctx.meta.trucoLevel.toUpperCase()}** (${ctx.meta.trucoValue} pts en juego)\n`;
		}
		if (ctx.meta.envidoChain.length > 0 && !ctx.meta.envidoResolved) {
			output += `🃏 **ENVIDO** activo (${ctx.meta.envidoValue} pts en juego)\n`;
		}
		output += "\n";

		// Cartas en mesa (separar rondas con enter)
		if (ctx.meta.history.length > 0 || ctx.meta.plays.length > 0) {
			output += "**Mesa:**\n";
			
			// Mostrar rondas completadas
			for (const ronda of ctx.meta.history) {
				output += ronda.map((play) => `<@${ctx.players[play.idx].id}>: ${play.card.value} ${play.card.suit}`).join(" | ");
				output += "\n";
			}
			
			// Mostrar ronda actual
			if (ctx.meta.plays.length > 0) {
				output += ctx.meta.plays.map((play) => `<@${ctx.players[play.idx].id}>: ${play.card.value} ${play.card.suit}`).join(" | ");
				output += "\n";
			}
			
			output += "\n";
		}

		// Bazas ganadas
		if (ctx.strategy.teamBased) {
			output += `**Bazas:** Equipo 1: ${ctx.meta.tricks[0]} | Equipo 2: ${ctx.meta.tricks[1]}\n`;
		} else {
			output += "**Bazas:** " + ctx.players.map((p, i) => `<@${p.id}>: ${ctx.meta.tricks[i]}`).join(" | ") + "\n";
		}

		return output;
	}

	playerChoices(ctx: GameRuntime<TrucoMeta>, userId: Snowflake) {
		const pid = ctx.players.findIndex((p) => p.id === userId);
		if (pid === -1 || ctx.meta.foldedPlayers.has(pid)) return [];

		const rows: ActionRowBuilder<ButtonBuilder>[] = [];

		// Si hay un envite pendiente y es tu turno de responder
		if (ctx.meta.waitingResponse && ctx.meta.pendingRespondent === pid) {
			const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents([
				new ButtonBuilder().setCustomId("quiero").setLabel("✅ Quiero").setStyle(ButtonStyle.Success),
				new ButtonBuilder().setCustomId("no-quiero").setLabel("❌ No Quiero").setStyle(ButtonStyle.Danger),
			]);

			// Puede redoblar el envite
			if (ctx.meta.pendingResponseType === "envido") {
				const canRealEnvido = !ctx.meta.envidoChain.includes("real-envido");
				const canFaltaEnvido = !ctx.meta.envidoChain.includes("falta-envido");

				if (canRealEnvido || canFaltaEnvido) {
					const row2 = new ActionRowBuilder<ButtonBuilder>();
					if (canRealEnvido) {
						row2.addComponents(new ButtonBuilder().setCustomId("real-envido").setLabel("Real Envido").setStyle(ButtonStyle.Primary));
					}
					if (canFaltaEnvido) {
						row2.addComponents(new ButtonBuilder().setCustomId("falta-envido").setLabel("Falta Envido").setStyle(ButtonStyle.Primary));
					}
					rows.push(row2);
				}
			} else if (ctx.meta.pendingResponseType === "truco") {
				if (ctx.meta.trucoLevel === "truco") {
					rows.push(
						new ActionRowBuilder<ButtonBuilder>().addComponents([
							new ButtonBuilder().setCustomId("retruco").setLabel("Retruco").setStyle(ButtonStyle.Primary),
						])
					);
				} else if (ctx.meta.trucoLevel === "retruco") {
					rows.push(
						new ActionRowBuilder<ButtonBuilder>().addComponents([
							new ButtonBuilder().setCustomId("vale4").setLabel("Vale Cuatro").setStyle(ButtonStyle.Primary),
						])
					);
				}
			}

			rows.unshift(row1);
			return rows;
		}

		// Si es tu turno de jugar
		if (ctx.current.id !== userId) return [];

		// Botones de cartas
		const player = ctx.players[pid];
		const cardButtons = player.hand.map((c, i) =>
			new ButtonBuilder().setCustomId(`play_${i}`).setLabel(`${c.value} ${c.suit}`).setStyle(ButtonStyle.Secondary)
		);

		if (cardButtons.length > 0) {
			rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(cardButtons));
		}

		// Botones de envites
		const actionRow = new ActionRowBuilder<ButtonBuilder>();

		// Envido (solo antes de jugar carta)
		if (ctx.meta.canSingEnvido && !ctx.meta.envidoResolved && !ctx.meta.waitingResponse) {
			if (!ctx.meta.envidoChain.includes("envido")) {
				actionRow.addComponents(new ButtonBuilder().setCustomId("envido").setLabel("Envido").setStyle(ButtonStyle.Primary));
			}
			if (!ctx.meta.envidoChain.includes("real-envido") && ctx.meta.envidoChain.length > 0) {
				actionRow.addComponents(new ButtonBuilder().setCustomId("real-envido").setLabel("Real Envido").setStyle(ButtonStyle.Primary));
			}
			if (!ctx.meta.envidoChain.includes("falta-envido") && ctx.meta.envidoChain.length > 0) {
				actionRow.addComponents(new ButtonBuilder().setCustomId("falta-envido").setLabel("Falta Envido").setStyle(ButtonStyle.Primary));
			}
		}

		// Truco
		if (!ctx.meta.waitingResponse) {
			if (ctx.meta.trucoLevel === null) {
				actionRow.addComponents(new ButtonBuilder().setCustomId("truco").setLabel("Truco").setStyle(ButtonStyle.Danger));
			}
		}

		// Mazo
		actionRow.addComponents(new ButtonBuilder().setCustomId("mazo").setLabel("Irse al Mazo").setStyle(ButtonStyle.Secondary));

		if (actionRow.components.length > 0) {
			rows.push(actionRow);
		}

		return rows;
	}

	scoreboard(ctx: GameRuntime<TrucoMeta>) {
		if (ctx.strategy.teamBased) {
			return `**Equipo 1:** ${ctx.meta.scores[0]} pts | **Equipo 2:** ${ctx.meta.scores[1]} pts`;
		}
		return ctx.players.map((p, i) => `<@${p.id}>: ${ctx.meta.scores[i]} pts`).join(" | ");
	}

	async botDecision(ctx: GameRuntime<TrucoMeta>, botUserId: Snowflake): Promise<string | null> {
		const botIdx = ctx.players.findIndex((p) => p.id === botUserId);
		if (botIdx === -1) return null;

		// Si está esperando una respuesta de envite del bot
		if (ctx.meta.waitingResponse && ctx.meta.pendingRespondent === botIdx) {
			// Estrategia simple: aceptar si el envido es bueno o rechazar truco si la mano es mala
			if (ctx.meta.pendingResponseType === "envido") {
				const envidoScore = calculateEnvido(ctx.players[botIdx].hand);
				// Aceptar si tiene más de 25 de envido
				return envidoScore >= 25 ? "quiero" : "no-quiero";
			}

			if (ctx.meta.pendingResponseType === "truco") {
				// Contar cartas fuertes (rank >= 10)
				const strongCards = ctx.players[botIdx].hand.filter((c) => trucoRank(c) >= 10).length;
				// Aceptar si tiene al menos una carta fuerte
				return strongCards >= 1 ? "quiero" : "no-quiero";
			}
		}

		// Si puede jugar una carta
		const bot = ctx.players[botIdx];
		if (bot.hand.length > 0 && ctx.current.id === botUserId && !ctx.meta.waitingResponse) {
			// Estrategia: jugar la carta de menor valor primero (guardar las buenas)
			let minRank = Infinity;
			let minIdx = 0;

			bot.hand.forEach((card, idx) => {
				const rank = trucoRank(card);
				if (rank < minRank) {
					minRank = rank;
					minIdx = idx;
				}
			});

			return `play_${minIdx}`;
		}

		return null;
	}

	/* ------------------------------------------------------------
	 * Internals
	 * ---------------------------------------------------------- */
	#dealNewHand(ctx: GameRuntime<TrucoMeta>, starterIdx = 0) {
		ctx.deck = DeckFactory.spanish([8, 9, "Comodín"]);
		ctx.players.forEach((p) => (p.hand = ctx.deck.splice(0, 3)));

		const numTeams = ctx.strategy.teamBased ? 2 : ctx.players.length;

		ctx.meta = {
			scores: ctx.meta?.scores ?? new Array(numTeams).fill(0),
			tricks: new Array(numTeams).fill(0),
			plays: [],
			history: [],
			starter: starterIdx,
			firstParda: false,

			trucoLevel: null,
			trucoValue: 1,
			trucoInitiator: null,
			trucoState: null,

			envidoChain: [],
			envidoValue: 0,
			envidoInitiator: null,
			envidoState: null,
			envidoScores: new Array(ctx.players.length).fill(null),
			envidoResolved: false,

			canSingEnvido: true,
			foldedPlayers: new Set(),
			waitingResponse: false,
			pendingResponseType: null,
			pendingRespondent: null,

			messages: [],
		} as TrucoMeta;

		ctx.turnIndex = starterIdx;

		// Refrescar manos
		ctx.players.forEach((p) => ctx.refreshHand(p.id));
	}
}
