import { CardSet, Card } from "./IGameStrategy.js";

export function ansiCard(card: Card, set: CardSet) {
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
		return `${c}${card.value}${card.suit === "X" ? "" : card.suit}${reset}`;
	} else {
		return `${reset}${card.value}${reset}`;
	}
}

function renderCardsAnsi(cards: Card[], set: CardSet) {
	if (!cards.length) return "Mesa vacía";
	return "```ansi\n" + cards.map((c) => ansiCard(c, set)).join(" ") + "\n```";
}

export { renderCardsAnsi };
