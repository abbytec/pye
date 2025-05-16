// src/utils/card-games/DeckFactory.ts
import { Card } from "./strategies/IGameStrategy.js";

export type UnoSuit = "🟥" | "🟩" | "🟦" | "🟨" | "X";
export type UnoValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "SKIP" | "REV" | "+2" | "COLOR" | "+4";

export type SpanishSuit = "⚔️" | "🌳" | "🏆" | "🪙"; // Espada, Basto, Copa, Oro
export type SpanishValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | "Comodín";

export type PokerSuit = "♥" | "♦" | "♣" | "♠";
export type PokerValue = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "J" | "Q" | "K" | "A";

/* ---------- API pública ---------- */
export class DeckFactory {
	public static readonly POKER_RANK: PokerValue[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K", "A"];
	public static readonly SPANISH_RANK: SpanishValue[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, "Comodín"];
	/** Mazo estándar de 52 cartas (♠, ♥, ♦, ♣) */
	static standard(): Card[] {
		const suits: PokerSuit[] = ["♥", "♦", "♣", "♠"] as const;
		return DeckFactory.#shuffle(suits.flatMap((s) => DeckFactory.POKER_RANK.map((v) => ({ suit: s, value: v }))));
	}

	static spanish(removed: SpanishValue[] = []): Card[] {
		const suits: SpanishSuit[] = ["⚔️", "🌳", "🏆", "🪙"] as const;
		const values: SpanishValue[] = DeckFactory.SPANISH_RANK.filter((v: SpanishValue) => !removed.includes(v));
		return DeckFactory.#shuffle(suits.flatMap((s) => values.map((v) => ({ suit: s, value: v }))));
	}

	/** Mazo UNO (108 cartas) */
	static uno(): Card[] {
		const colors: UnoSuit[] = ["🟥", "🟩", "🟦", "🟨"];
		const deck: Card[] = [];

		for (const c of colors) {
			deck.push({ suit: c, value: 0 }); // un 0
			for (
				let n = 1;
				n <= 9;
				n++ // dos 1-9
			)
				deck.push({ suit: c, value: n as UnoValue }, { suit: c, value: n as UnoValue });

			for (const v of ["SKIP", "REV", "+2"] as UnoValue[]) deck.push({ suit: c, value: v }, { suit: c, value: v });
		}
		for (let i = 0; i < 4; i++) deck.push({ suit: "X", value: "COLOR" }, { suit: "X", value: "+4" });
		return DeckFactory.#shuffle(deck);
	}

	/* ---------- util privado ---------- */
	static #shuffle<T>(a: T[]): T[] {
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}
}
