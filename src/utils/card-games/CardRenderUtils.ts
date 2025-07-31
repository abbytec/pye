import { PokerSuit, SpanishSuit, UnoSuit } from "./DeckFactory.js";
import { Card } from "./strategies/IGameStrategy.js";

export function ansiCard(card: Card) {
	const reset = "\u001b[0m";
	const c = (
		{
			// poker
			"♥": "\u001b[31m", // rojo
			"♦": "\u001b[31m", // rojo
			"♣": "\u001b[30m", // negro
			"♠": "\u001b[30m", // negro
			// uno
			"🟥": "\u001b[31m", // rojo
			"🟩": "\u001b[32m", // verde
			"🟦": "\u001b[34m", // azul
			"🟨": "\u001b[33m", // amarillo
			X: "\u001b[30m", // X = comodín (negro)
			// spanish
			"⚔️": "\u001b[34m", // azul
			"🌳": "\u001b[32m", // verde
			"🏆": "\u001b[31m", // rojo
			"🪙": "\u001b[33m", // amarillo
		} as Record<PokerSuit | UnoSuit | SpanishSuit, string>
	)[card.suit];

	if (c) {
		return `${c}${card.value} ${card.suit === "X" ? "" : card.suit}${reset}`;
	} else {
		return `${reset}${card.value}${reset}`;
	}
}

function renderCardsAnsi(cards: Card[]) {
	if (!cards.length) return "Mesa vacía";
	return "```ansi\n" + cards.map((c) => ansiCard(c)).join(" | ") + "\n```";
}

export { renderCardsAnsi };
