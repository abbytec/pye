import { CardSet, Card } from "./IGameStrategy.js";

/* ------------------------------------------------------------------
 *  Helper utilities (deck generation, shuffling, ANSI output)
 * ----------------------------------------------------------------*/
function createDeck(set: CardSet): Card[] {
	if (set === "poker") {
		const suits = ["♥", "♦", "♣", "♠"];
		const values = ["A", 2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K"];
		return suits.flatMap((s) => values.map((v) => ({ suit: s, value: v })));
	}
	// spanish 40-card deck
	const suits = ["♦", "♥", "♣", "♠"]; // oros, copas, bastos, espadas (ansi examples)
	const values: (number | string)[] = [1, 2, 3, 4, 5, 6, 7, "S", "C", "R"]; // sota, caballo, rey
	return suits.flatMap((s) => values.map((v) => ({ suit: s, value: v })));
}

function shuffle<T>(array: T[]) {
	for (let i = array.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[array[i], array[j]] = [array[j], array[i]];
	}
}

function ansiCard(card: Card, set: CardSet) {
	const reset = "\u001b[0m";
	const c = {
		// poker
		"♥": "\u001b[31m", // rojo
		"♦": "\u001b[31m", // rojo
		"♣": "\u001b[30m", // negro
		"♠": "\u001b[30m", // negro
		// uno
		R: "\u001b[31m", // rojo
		G: "\u001b[32m", // verde
		B: "\u001b[34m", // azul
		Y: "\u001b[33m", // amarillo
		X: "\u001b[30m", // X = comodín (negro)
	}[card.suit];

	if (c) {
		return `${c}${card.value}${set === "poker" ? card.suit : ""}${reset}`;
	} else {
		return `${reset}${card.value}${reset}`;
	}
}

function renderCardsAnsi(cards: Card[], set: CardSet) {
	if (!cards.length) return "Mesa vacía";
	return "```ansi\n" + cards.map((c) => ansiCard(c, set)).join(" ") + "\n```";
}

const POKER_RANK: (string | number)[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K", "A"];

export { createDeck, shuffle, renderCardsAnsi, POKER_RANK };
