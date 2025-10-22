import { Snowflake, ButtonInteraction, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuInteraction } from "discord.js";
import { Card, CardSet, GameStrategy, PlayerLimits } from "./IGameStrategy.js";
import { renderCardsAnsi } from "../CardRenderUtils.js";
import { GameRuntime, PlayerState } from "../GameRuntime.js";
import { DeckFactory, PokerValue } from "../DeckFactory.js";
import ChipsShopModule, { ChipsShopConfig } from "../ChipsShopModule.js";

type HandRank = "royal-flush" | "four-of-a-kind" | "full-house" | "flush" | "straight" | "three-of-a-kind" | "two-pair" | "one-pair" | "high-card";

interface PokerMeta {
	chips: Record<Snowflake, number>;
	bets: Record<Snowflake, number>;
	currentBet: number;
	fold: Set<Snowflake>;
	phase: "preflop" | "flop" | "turn" | "river" | "showdown";
	isProcessing?: boolean;
	round: number;
	ante: number;
	potChips: Record<Snowflake, number>;
}

interface PlayerWithHand extends PlayerState {
	bestHand?: Card[];
	handRank?: HandRank;
	rankValue?: number;
}

/**
 * Texas Hold'em simplificado para 2-6 jugadores
 * - Cada jugador comienza con chips
 * - Rondas de apuestas en preflop, flop, turn, river
 * - Al showdown, se evalúan las manos (mejor mano de 5 cartas)
 * - Prevención de race conditions
 */
class PokerStrategy implements GameStrategy<PokerMeta> {
	readonly name = "Poker";
	readonly limits: PlayerLimits = { min: 2, max: 6 };
	readonly cardSet: CardSet = "poker";
	readonly teamBased = false;

	private shopsConfig: ChipsShopConfig;

	constructor() {
		// Configurar el módulo de tienda
		this.shopsConfig = ChipsShopModule.createDefaultConfig("chips");
		// Validación personalizada: no pueden comprar si están en fold
		this.shopsConfig.canBuyFn = (ctx, userId) => {
			return !ctx.meta.fold.has(userId);
		};
	}

	async init(ctx: GameRuntime<PokerMeta>) {
		ctx.deck = DeckFactory.standard();

		const startingChips = 500; // Chips iniciales
		const chips: Record<Snowflake, number> = {};
		const potChips: Record<Snowflake, number> = {};
		
		ctx.players.forEach((p) => {
			chips[p.id] = startingChips;
			potChips[p.id] = ctx.bet; // La apuesta es el ante inicial
			p.hand = [];
		});

		ctx.meta = {
			chips,
			bets: {},
			currentBet: 0,
			fold: new Set(),
			phase: "preflop",
			round: 1,
			ante: ctx.bet,
			potChips,
		};

		// Repartir 2 cartas a cada jugador
		for (let i = 0; i < 2; i++) {
			ctx.players.forEach((p) => {
				if (ctx.deck.length > 0) {
					p.hand.push(ctx.deck.shift() as Card);
				}
			});
		}

		await ctx.sendTable();
	}

	async handleAction(ctx: GameRuntime<PokerMeta>, userId: Snowflake, interaction: ButtonInteraction | StringSelectMenuInteraction) {
		await interaction.deferUpdate().catch(() => {});

		// Delegar manejo de tienda al módulo
		if (ChipsShopModule.isShopAction(interaction.customId)) {
			const handled = await ChipsShopModule.handleChipsShopAction(ctx, userId, interaction, this.shopsConfig);
			if (handled) return;
		}

		// Prevenir race conditions
		if (ctx.meta.isProcessing) {
			await interaction.followUp({ content: "⏳ Acción en progreso, esperá.", ephemeral: true });
			return;
		}

		ctx.meta.isProcessing = true;

		try {
			const action = interaction.customId;

			if (action === "fold") {
				ctx.meta.fold.add(userId);
				await this.advanceToNextPlayer(ctx);
				const remaining = ctx.players.filter((p) => !ctx.meta.fold.has(p.id)).length;

				if (remaining === 1) {
					// Solo queda un jugador, termina
					const winner = ctx.players.find((p) => !ctx.meta.fold.has(p.id))!;
					await ctx.sendTable();
					setTimeout(() => {
						ctx.finish(winner.displayName, winner.id);
					}, 1500);
					return;
				}

				await ctx.sendTable();
			} else if (action === "check") {
				if (ctx.meta.bets[userId] !== ctx.meta.currentBet) {
					await interaction.followUp({ content: "⏳ Deben igualar la apuesta para pasar (check).", ephemeral: true });
					ctx.meta.isProcessing = false;
					return;
				}
				await this.advanceToNextPlayer(ctx);
				if (this.isRoundComplete(ctx)) {
					await this.advancePhase(ctx);
				}
				await ctx.sendTable();
			} else if (action === "call") {
				const amountNeeded = ctx.meta.currentBet - (ctx.meta.bets[userId] ?? 0);
				const chips = ctx.meta.chips[userId];
				const amountToCall = Math.min(amountNeeded, chips);

				ctx.meta.chips[userId] -= amountToCall;
				ctx.meta.bets[userId] = (ctx.meta.bets[userId] ?? 0) + amountToCall;

				await this.advanceToNextPlayer(ctx);
				if (this.isRoundComplete(ctx)) {
					await this.advancePhase(ctx);
				}
				await ctx.sendTable();
			} else if (action.startsWith("raise_")) {
				const raiseAmount = parseInt(action.split("_")[1]);
				const chips = ctx.meta.chips[userId];

				if (raiseAmount <= 0 || raiseAmount > chips) {
					await interaction.followUp({ content: "⏳ Apuesta inválida.", ephemeral: true });
					ctx.meta.isProcessing = false;
					return;
				}

				ctx.meta.chips[userId] -= raiseAmount;
				ctx.meta.bets[userId] = (ctx.meta.bets[userId] ?? 0) + raiseAmount;
				ctx.meta.currentBet = Math.max(ctx.meta.currentBet, ctx.meta.bets[userId]);

				await this.advanceToNextPlayer(ctx);
				await ctx.sendTable();
			}
		} finally {
			ctx.meta.isProcessing = false;
		}
	}

	private async advanceToNextPlayer(ctx: GameRuntime<PokerMeta>) {
		let nextIdx = ctx.turnIndex;
		const maxAttempts = ctx.players.length;
		let attempts = 0;

		do {
			nextIdx = (nextIdx + 1) % ctx.players.length;
			attempts++;
		} while (
			ctx.meta.fold.has(ctx.players[nextIdx].id) &&
			attempts < maxAttempts
		);

		ctx.turnIndex = nextIdx;
	}

	private isRoundComplete(ctx: GameRuntime<PokerMeta>): boolean {
		const activePlayers = ctx.players.filter((p) => !ctx.meta.fold.has(p.id));
		if (activePlayers.length <= 1) return true;

		return activePlayers.every((p) => ctx.meta.bets[p.id] === ctx.meta.currentBet);
	}

	private async advancePhase(ctx: GameRuntime<PokerMeta>) {
		const phases: PokerMeta["phase"][] = ["preflop", "flop", "turn", "river", "showdown"];
		const currentIdx = phases.indexOf(ctx.meta.phase);

		if (currentIdx >= phases.length - 1) {
			// Showdown
			await this.performShowdown(ctx);
			return;
		}

		ctx.meta.phase = phases[currentIdx + 1];

		// Repartir cartas según la fase
		if (ctx.meta.phase === "flop") {
			// 3 cartas comunitarias
			for (let i = 0; i < 3; i++) {
				if (ctx.deck.length > 0) {
					ctx.table.push(ctx.deck.shift() as Card);
				}
			}
		} else if (ctx.meta.phase === "turn" || ctx.meta.phase === "river") {
			// 1 carta comunitaria
			if (ctx.deck.length > 0) {
				ctx.table.push(ctx.deck.shift() as Card);
			}
		}

		// Reset bets para nueva ronda
		ctx.meta.currentBet = 0;
		ctx.players.forEach((p) => {
			if (!ctx.meta.fold.has(p.id)) {
				ctx.meta.bets[p.id] = 0;
			}
		});
	}

	private async performShowdown(ctx: GameRuntime<PokerMeta>) {
		const activePlayers = ctx.players.filter((p) => !ctx.meta.fold.has(p.id));

		if (activePlayers.length === 0) {
			ctx.finish(null);
			return;
		}

		if (activePlayers.length === 1) {
			const winner = activePlayers[0];
			ctx.finish(winner.displayName, winner.id);
			return;
		}

		// Evaluar manos
		const evaluated = activePlayers.map((p) => ({
			player: p,
			bestHand: this.findBestHand(p.hand, ctx.table),
		}));

		evaluated.sort((a, b) => {
			const cmp = this.compareHands(a.bestHand, b.bestHand);
			return -cmp; // descendente (mayor es mejor)
		});

		const winner = evaluated[0].player;
		await ctx.sendTable();
		setTimeout(() => {
			ctx.finish(winner.displayName, winner.id);
		}, 2000);
	}

	private findBestHand(hole: Card[], community: Card[]): Card[] {
		// Combina cartas y encuentra la mejor mano de 5 cartas
		const allCards = [...hole, ...community];
		let best: Card[] = allCards.slice(0, 5);
		let bestRank = this.evaluateHand(best);

		// Genera todas las combinaciones de 5 cartas posibles
		for (let i = 0; i < allCards.length - 4; i++) {
			for (let j = i + 1; j < allCards.length - 3; j++) {
				for (let k = j + 1; k < allCards.length - 2; k++) {
					for (let l = k + 1; l < allCards.length - 1; l++) {
						for (let m = l + 1; m < allCards.length; m++) {
							const hand = [allCards[i], allCards[j], allCards[k], allCards[l], allCards[m]];
							const rank = this.evaluateHand(hand);
							if (this.compareHands(hand, best) > 0) {
								best = hand;
								bestRank = rank;
							}
						}
					}
				}
			}
		}

		return best;
	}

	private evaluateHand(cards: Card[]): { rank: HandRank; rankValue: number } {
		const sorted = this.sortByValue(cards);
		const values = sorted.map((c) => c.value as PokerValue);
		const suits = sorted.map((c) => c.suit);

		if (this.isRoyalFlush(values, suits)) return { rank: "royal-flush", rankValue: 10 };
		if (this.isStraightFlush(values, suits)) return { rank: "four-of-a-kind", rankValue: 9 };
		if (this.isFourOfAKind(values)) return { rank: "four-of-a-kind", rankValue: 8 };
		if (this.isFullHouse(values)) return { rank: "full-house", rankValue: 7 };
		if (this.isFlush(suits)) return { rank: "flush", rankValue: 6 };
		if (this.isStraight(values)) return { rank: "straight", rankValue: 5 };
		if (this.isThreeOfAKind(values)) return { rank: "three-of-a-kind", rankValue: 4 };
		if (this.isTwoPair(values)) return { rank: "two-pair", rankValue: 3 };
		if (this.isOnePair(values)) return { rank: "one-pair", rankValue: 2 };

		return { rank: "high-card", rankValue: 1 };
	}

	private sortByValue(cards: Card[]): Card[] {
		return [...cards].sort((a, b) => {
			const rankA = DeckFactory.POKER_RANK.indexOf(a.value as PokerValue);
			const rankB = DeckFactory.POKER_RANK.indexOf(b.value as PokerValue);
			return rankB - rankA;
		});
	}

	private isRoyalFlush(values: PokerValue[], suits: string[]): boolean {
		return (
			this.isFlush(suits) &&
			JSON.stringify(values) === JSON.stringify(["A", "K", "Q", "J", "10"])
		);
	}

	private isStraightFlush(values: PokerValue[], suits: string[]): boolean {
		return this.isFlush(suits) && this.isStraight(values);
	}

	private isFourOfAKind(values: PokerValue[]): boolean {
		return this.countValues(values).some((count) => count === 4);
	}

	private isFullHouse(values: PokerValue[]): boolean {
		const counts = this.countValues(values);
		return counts.includes(3) && counts.includes(2);
	}

	private isFlush(suits: string[]): boolean {
		return suits.every((s) => s === suits[0]);
	}

	private isStraight(values: PokerValue[]): boolean {
		const ranks = values.map((v) => DeckFactory.POKER_RANK.indexOf(v));
		const sorted = ranks.sort((a, b) => b - a);
		for (let i = 0; i < sorted.length - 1; i++) {
			if (sorted[i] - sorted[i + 1] !== 1) return false;
		}
		return true;
	}

	private isThreeOfAKind(values: PokerValue[]): boolean {
		return this.countValues(values).some((count) => count === 3);
	}

	private isTwoPair(values: PokerValue[]): boolean {
		const counts = this.countValues(values).filter((c) => c === 2);
		return counts.length === 2;
	}

	private isOnePair(values: PokerValue[]): boolean {
		return this.countValues(values).some((count) => count === 2);
	}

	private countValues(values: PokerValue[]): number[] {
		const map = new Map<PokerValue, number>();
		values.forEach((v) => map.set(v, (map.get(v) ?? 0) + 1));
		return Array.from(map.values());
	}

	private compareHands(hand1: Card[], hand2: Card[]): number {
		const rank1 = this.evaluateHand(hand1);
		const rank2 = this.evaluateHand(hand2);

		if (rank1.rankValue !== rank2.rankValue) {
			return rank1.rankValue - rank2.rankValue;
		}

		// Mismo rango, comparar cartas altas
		const sorted1 = this.sortByValue(hand1);
		const sorted2 = this.sortByValue(hand2);

		for (let i = 0; i < sorted1.length; i++) {
			const r1 = DeckFactory.POKER_RANK.indexOf(sorted1[i].value as PokerValue);
			const r2 = DeckFactory.POKER_RANK.indexOf(sorted2[i].value as PokerValue);
			if (r1 !== r2) return r1 - r2;
		}

		return 0;
	}

	publicState(ctx: GameRuntime<PokerMeta>): string {
		const potTotal = Object.values(ctx.meta.potChips).reduce((a, b) => a + b, 0);
		const state = [
			`**Fase:** ${ctx.meta.phase.toUpperCase()}`,
			`**Apuesta actual:** ${ctx.meta.currentBet} fichas`,
			`**Pot total:** ${potTotal} fichas`,
			`**Mesa:** ${renderCardsAnsi(ctx.table) || "(vacía)"}`,
		].join("\n");

		const playerStates = ctx.players
			.map((p) => {
				const status = ctx.meta.fold.has(p.id) ? "❌ FOLD" : `💰 ${ctx.meta.chips[p.id]}`;
				const betStr = ctx.meta.bets[p.id] ? ` (apuestó ${ctx.meta.bets[p.id]})` : "";
				const potStr = ctx.meta.potChips[p.id] ? ` [Pot: ${ctx.meta.potChips[p.id]}]` : "";
				const turn = p.id === ctx.current.id && !ctx.meta.fold.has(p.id) ? " ⏳" : "";
				return `${p.displayName}: ${status}${betStr}${potStr}${turn}`;
			})
			.join("\n");

		return `${state}\n\n**Jugadores:**\n${playerStates}`;
	}

	playerChoices(ctx: GameRuntime<PokerMeta>, userId: Snowflake): ActionRowBuilder<any>[] {
		const rows: ActionRowBuilder<any>[] = [];

		// Si no es su turno o está en fold, solo mostrar botón de tienda
		if (userId !== ctx.current.id || ctx.meta.fold.has(userId)) {
			return ChipsShopModule.addShopButtonToRows(rows);
		}

		const userBet = ctx.meta.bets[userId] ?? 0;
		const userChips = ctx.meta.chips[userId];
		const amountToCall = ctx.meta.currentBet - userBet;

		const buttons: ButtonBuilder[] = [];

		// Botón Fold
		buttons.push(
			new ButtonBuilder()
				.setCustomId("fold")
				.setLabel("Fold")
				.setStyle(ButtonStyle.Danger)
		);

		// Botón Check (si no hay apuesta pendiente)
		if (amountToCall === 0) {
			buttons.push(
				new ButtonBuilder()
					.setCustomId("check")
					.setLabel("Check")
					.setStyle(ButtonStyle.Primary)
			);
		} else {
			// Botón Call (igualar apuesta)
			buttons.push(
				new ButtonBuilder()
					.setCustomId("call")
					.setLabel(`Call (${amountToCall})`)
					.setStyle(ButtonStyle.Success)
			);
		}

		// Botones Raise (en incrementos)
		const raiseOptions = [
			Math.min(50, userChips),
			Math.min(100, userChips),
			Math.min(200, userChips),
		].filter((r) => r > 0 && r <= userChips);

		raiseOptions.forEach((amount) => {
			buttons.push(
				new ButtonBuilder()
					.setCustomId(`raise_${amount}`)
					.setLabel(`Raise +${amount}`)
					.setStyle(ButtonStyle.Secondary)
			);
		});

		rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(0, 5)));
		return ChipsShopModule.addShopButtonToRows(rows);
	}

	scoreboard(ctx: GameRuntime<PokerMeta>): string {
		return `**Ronda:** ${ctx.meta.round}`;
	}

	async botDecision(ctx: GameRuntime<PokerMeta>, botUserId: Snowflake): Promise<string | null> {
		if (ctx.current.id !== botUserId || ctx.meta.fold.has(botUserId)) {
			return null;
		}

		const botChips = ctx.meta.chips[botUserId];
		const currentBet = ctx.meta.currentBet;
		const botBet = ctx.meta.bets[botUserId] ?? 0;
		const costToCall = currentBet - botBet;
		
		// Calcular tamaño del pot
		const potSize = Object.values(ctx.meta.bets).reduce((a, b) => a + b, 0);
		
		// Contar jugadores activos
		const activePlayers = ctx.players.filter((p) => !ctx.meta.fold.has(p.id)).length;
		
		// Evaluar fortaleza de mano
		const handStrength = this.evaluateHandStrength(ctx, botUserId, activePlayers);
		
		// Calcular pot odds
		const potOdds = costToCall > 0 ? potSize / costToCall : Infinity;
		
		// Estrategia adaptativa según fase
		let decision = "fold";
		
		switch (ctx.meta.phase) {
			case "preflop":
				decision = this.decidePreflop(handStrength, costToCall, botChips, activePlayers, potOdds);
				break;
			case "flop":
				decision = this.decideFlop(handStrength, costToCall, botChips, activePlayers, potOdds, potSize);
				break;
			case "turn":
			case "river":
				decision = this.decideLate(handStrength, costToCall, botChips, activePlayers, potOdds, potSize);
				break;
		}
		
		return decision;
	}

	/**
	 * Evalúa la fortaleza relativa de la mano (0-1)
	 * Considera: tipo de mano, posición, opponents, tablero
	 */
	private evaluateHandStrength(ctx: GameRuntime<PokerMeta>, botUserId: Snowflake, activePlayers: number): number {
		const botPlayer = ctx.players.find((p) => p.id === botUserId);
		if (!botPlayer) return 0;

		// Evaluar la mejor mano posible
		const bestHand = this.findBestHand(botPlayer.hand, ctx.table);
		const handEval = this.evaluateHand(bestHand);

		let strength = 0;

		// Base: valor de la mano
		const handValues: Record<HandRank, number> = {
			"royal-flush": 0.95,
			"four-of-a-kind": 0.90,
			"full-house": 0.85,
			"flush": 0.70,
			"straight": 0.65,
			"three-of-a-kind": 0.60,
			"two-pair": 0.45,
			"one-pair": 0.30,
			"high-card": 0.15,
		};

		strength = handValues[handEval.rank] ?? 0.15;

		// Ajustar por cantidad de jugadores (más jugadores = necesitas mano más fuerte)
		if (activePlayers > 1) {
			strength *= 0.95 - (activePlayers - 1) * 0.05;
		}

		// En preflop, bonificar pocket pairs y AK/AQ
		if (ctx.meta.phase === "preflop") {
			const value1 = botPlayer.hand[0].value;
			const value2 = botPlayer.hand[1].value;
			
			if (value1 === value2) {
				// Pocket pair: +0.15
				strength = Math.min(0.8, strength + 0.15);
			} else if (
				(value1 === "A" || value2 === "A") &&
				(value1 === "K" || value2 === "K" || value1 === "Q" || value2 === "Q")
			) {
				// AK, AQ: +0.10
				strength = Math.min(0.75, strength + 0.10);
			}
		}

		return Math.min(1, Math.max(0, strength));
	}

	/**
	 * Decisión en PREFLOP (solo hole cards)
	 */
	private decidePreflop(
		handStrength: number,
		costToCall: number,
		botChips: number,
		activePlayers: number,
		potOdds: number
	): string {
		// Estrategia muy agresiva con mano premium (AA, KK, AK)
		if (handStrength > 0.75) {
			if (costToCall === 0) return "check";
			const raiseAmount = Math.min(50, botChips);
			return `raise_${raiseAmount}`;
		}

		// Mano fuerte
		if (handStrength > 0.60) {
			if (costToCall === 0) return "check";
			if (costToCall <= 20 && potOdds > 2) return "call";
			if (botChips > costToCall * 2) return `raise_${Math.min(30, botChips)}`;
			return "call";
		}

		// Mano media: depende de pot odds y posición
		if (handStrength > 0.40) {
			if (costToCall === 0) return "check";
			if (potOdds > 3 && costToCall < botChips * 0.1) return "call";
			return "fold";
		}

		// Mano débil: generalmente fold
		if (costToCall === 0) return "check";
		if (handStrength > 0.25 && potOdds > 5 && costToCall < botChips * 0.05) {
			return "call"; // Call implícito con odds muy altos
		}
		return "fold";
	}

	/**
	 * Decisión en FLOP (3 cartas comunitarias)
	 */
	private decideFlop(
		handStrength: number,
		costToCall: number,
		botChips: number,
		activePlayers: number,
		potOdds: number,
		potSize: number
	): string {
		// Mano muy fuerte en flop
		if (handStrength > 0.75) {
			if (costToCall === 0) return "check";
			if (costToCall <= potSize * 0.15) return "call"; // Call moderado
			if (botChips > costToCall * 2) return `raise_${Math.min(100, botChips)}`;
			return "call";
		}

		// Mano media-fuerte
		if (handStrength > 0.55) {
			if (costToCall === 0) return "check";
			if (potOdds > 2.5 && costToCall < potSize * 0.2) return "call";
			return "fold";
		}

		// Mano media: ser cauteloso
		if (handStrength > 0.35) {
			if (costToCall === 0) return "check";
			if (potOdds > 4 && costToCall < botChips * 0.08) return "call";
			return "fold";
		}

		// Mano débil: casi siempre fold
		if (costToCall === 0) return "check";
		if (potOdds > 6 && costToCall < botChips * 0.03) return "call";
		return "fold";
	}

	/**
	 * Decisión en TURN/RIVER (tablero completo o casi completo)
	 */
	private decideLate(
		handStrength: number,
		costToCall: number,
		botChips: number,
		activePlayers: number,
		potOdds: number,
		potSize: number
	): string {
		// En river/turn, las decisiones son más binarias
		
		// Mano muy fuerte
		if (handStrength > 0.75) {
			if (costToCall === 0) return "check";
			if (costToCall <= potSize * 0.2) return "call"; // Call agresivo
			if (botChips > costToCall * 3) return `raise_${Math.min(200, botChips)}`;
			return "call";
		}

		// Mano media-fuerte: depende de pot odds
		if (handStrength > 0.50) {
			if (costToCall === 0) return "check";
			if (potOdds > 2 && costToCall < potSize * 0.25) return "call";
			return "fold";
		}

		// Mano media: muy selectivo
		if (handStrength > 0.30) {
			if (costToCall === 0) return "check";
			if (potOdds > 3.5 && costToCall < botChips * 0.1) return "call";
			return "fold";
		}

		// Mano débil: casi siempre fold a menos que odds sean absurdas
		if (costToCall === 0) return "check";
		return "fold";
	}
}

export default PokerStrategy;
