// src/utils/card-games/TrucoStrategy.ts
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Snowflake } from "discord.js";
import { GameRuntime, PlayerState } from "../GameRuntime.js";
import { Card, GameStrategy } from "./IGameStrategy.js";
import { DeckFactory } from "../DeckFactory.js";

/**
 * ────────────────────────────────────────────────────────────────
 *  Types & helpers
 * ────────────────────────────────────────────────────────────────
 */
interface TrucoMeta {
	/** Puntos acumulados por jugador (indexado según ctx.players) */
	scores: number[];
	/** Cantidad de bazas ganadas en la mano actual */
	tricks: number[];
	/** Cartas jugadas en la baza actual */
	plays: { idx: number; card: Card }[]; // idx = índice de jugador, turno en curso
	history: { idx: number; card: Card }[][]; //turnos jugados
	/** Quién empezó la mano (gana si todas las bazas son pardas) */
	starter: number;
	firstParda: boolean;
}

const MAX_SCORE = 12;

// Ranking de Truco de mayor (14) a menor (1)
function trucoRank(card: Card): number {
	const { suit, value } = card;
	// Suits originarios: A = Espadas, B = Bastos, C = Copas, D = Oros
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

/**
 * ────────────────────────────────────────────────────────────────
 *  Truco Strategy (simplificado, 1 punto por mano, sin envites)
 * ────────────────────────────────────────────────────────────────
 */
export default class TrucoStrategy implements GameStrategy<TrucoMeta> {
	readonly name = "Truco";
	readonly limits = { min: 2, max: 2 } as const; // 1 vs 1 simplificado
	readonly cardSet = "spanish";
	readonly teamBased = false;

	/* ------------------------------------------------------------
	 * Setup
	 * ---------------------------------------------------------- */
	async init(ctx: GameRuntime<TrucoMeta>) {
		this.#dealNewHand(ctx);
		await ctx.sendTable();
	}

	/* ------------------------------------------------------------
	 * Interacciones de botón (play_{idx})
	 * ---------------------------------------------------------- */
	async handleAction(ctx: GameRuntime<TrucoMeta>, uid: string, interaction: ButtonInteraction): Promise<void> {
		const pid = ctx.players.findIndex((p) => p.id === uid);
		if (pid === -1) {
			await interaction.reply({ content: "No formas parte de la partida", ephemeral: true });
			return;
		}

		if (!interaction.customId.startsWith("play_")) return;

		// Solo puede jugar el turno actual
		if (ctx.current.id !== uid) {
			await interaction.reply({ content: "⏳ Espera tu turno", ephemeral: true });
			return;
		}

		const idxInHand = Number(interaction.customId.split("_")[1]);
		const player = ctx.players[pid];
		const card = player.hand[idxInHand];
		if (!card) {
			await interaction.reply({ content: "Carta inválida", ephemeral: true });
			return;
		}

		// Jugar carta
		player.hand.splice(idxInHand, 1);
		ctx.meta.plays.push({ idx: pid, card });

		await interaction.deferUpdate();

		// Si ambos ya jugaron → resolver baza
		if (ctx.meta.plays.length === 2) {
			ctx.meta.history.push([...ctx.meta.plays]);

			const [first, second] = ctx.meta.plays;
			const winnerRel = winnerOfPlay(first.card, second.card); // -1 parda
			if (winnerRel !== -1) {
				const winnerIdx = ctx.meta.plays[winnerRel].idx;
				ctx.meta.tricks[winnerIdx]++;
				// La próxima baza la empieza el ganador
				ctx.turnIndex = winnerIdx;
			} else {
				// Parda → la próxima baza la inicia el que tiró primero
				ctx.turnIndex = first.idx;
				if (ctx.meta.history.length === 1) ctx.meta.firstParda = true;
			}

			ctx.meta.plays = []; // limpia la baza actual
		}

		// ¿Fin de mano? (alguien ganó 2 bazas)
		/* ───────────── Determinar ganador de la mano ───────────── */
		let roundWinnerIdx: number = -1;

		// 1) Si la primera baza fue parda, la segunda decide
		if (ctx.meta.firstParda && ctx.meta.history.length === 2) {
			const second = ctx.meta.history[1];
			const winnerRelSecond = winnerOfPlay(second[0].card, second[1].card);
			if (winnerRelSecond !== -1) roundWinnerIdx = second[winnerRelSecond].idx;
		}

		// 2) Caso normal: alguien ganó 2 bazas
		if (roundWinnerIdx === -1) {
			roundWinnerIdx = ctx.meta.tricks.findIndex((t) => t === 2);
		}

		// 3) Si nadie llegó a 2 y no quedan cartas, gana quien empezó
		const noCardsLeft = ctx.players.every((p) => p.hand.length === 0);
		if (roundWinnerIdx === -1 && noCardsLeft) roundWinnerIdx = ctx.meta.starter;

		/* ───────────── Fin de mano / partida ───────────── */
		if (roundWinnerIdx !== -1) {
			ctx.meta.scores[roundWinnerIdx]++;

			await ctx.sendTable();
			await new Promise((r) => setTimeout(r, 3000));

			// Fin de partida
			if (ctx.meta.scores[roundWinnerIdx] >= MAX_SCORE) {
				await ctx.sendTable();
				ctx.finish(ctx.players[roundWinnerIdx].displayName, ctx.players[roundWinnerIdx].id);
				return;
			}

			// Repartir nueva mano
			this.#dealNewHand(ctx, roundWinnerIdx);
		}

		/* ───────────── Avanzar turno y refrescar UI ───────────── */
		if (ctx.meta.plays.length === 1) ctx.nextTurn();

		await ctx.refreshHand(uid);
		await ctx.refreshHand(ctx.current.id);
		await ctx.sendTable();
	}

	/* ------------------------------------------------------------
	 * UI y estado público
	 * ---------------------------------------------------------- */
	publicState(ctx: GameRuntime<TrucoMeta>) {
		const todasLasCartas = [...ctx.meta.history.flat(), ...ctx.meta.plays];
		const mesa =
			todasLasCartas.length === 0
				? "Sin cartas en la mesa."
				: todasLasCartas.map((play) => `<@${ctx.players[play.idx].id}> jugó: ${play.card.value} ${play.card.suit}`).join("\n");
		const tricks = ctx.players.map((p, i) => `• <@${p.id}>: ganó ${ctx.meta.tricks[i]} turnos esta mano`).join("\n");

		return `**Cartas en mesa:**\n${mesa}\n\n${tricks}`;
	}

	playerChoices(ctx: GameRuntime<TrucoMeta>, userId: Snowflake) {
		if (ctx.current.id !== userId) return [];
		const player = ctx.current;

		const buttons = player.hand.map((c, i) =>
			new ButtonBuilder().setCustomId(`play_${i}`).setLabel(`${c.value} ${c.suit}`).setStyle(ButtonStyle.Secondary)
		);

		const rows: ActionRowBuilder<ButtonBuilder>[] = [];
		const CHUNK = 5;
		for (let i = 0; i < buttons.length; i += CHUNK) {
			rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + CHUNK)));
		}
		return rows;
	}

	scoreboard(ctx: GameRuntime<TrucoMeta>) {
		return ctx.players.map((p, i) => `• <@${p.id}>: ${ctx.meta.scores[i]} pts`).join("\n");
	}

	/* ------------------------------------------------------------
	 * Internals
	 * ---------------------------------------------------------- */
	#dealNewHand(ctx: GameRuntime<TrucoMeta>, starterIdx = 0) {
		ctx.deck = DeckFactory.spanish([8, 9, "Comodín"]);
		ctx.players.forEach((p) => (p.hand = ctx.deck.splice(0, 3)));

		ctx.meta = {
			scores: ctx.meta?.scores ?? [0, 0],
			tricks: [0, 0],
			plays: [],
			history: [],
			starter: starterIdx,
			firstParda: false,
		} as TrucoMeta;

		ctx.turnIndex = starterIdx;

		// Oculta botones viejos
		ctx.players.forEach((p) => ctx.refreshHand(p.id));
	}
}
