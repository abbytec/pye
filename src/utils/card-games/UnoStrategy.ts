// src/utils/card-games/UnoStrategy.ts
import { ButtonBuilder, ButtonInteraction, ButtonStyle, MessageFlags } from "discord.js";
import { GameRuntime, PlayerState, sendTable } from "./GameRuntime.js";
import { Card, GameStrategy } from "./IGameStrategy.js";
import { renderCardsAnsi } from "./CardUtils.js";

type UnoColor = "R" | "G" | "B" | "Y" | "X"; // X = negro (wild)
type UnoValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "SKIP" | "REV" | "+2" | "W" | "+4";

function mk(color: UnoColor, value: string | number): Card {
	return { suit: color, value };
}

// ──────────────────────────────────────────────────────────────────
//  Estrategia UNO
// ──────────────────────────────────────────────────────────────────
export default class UnoStrategy implements GameStrategy {
	readonly name = "Uno";
	readonly limits = { min: 2, max: 10 };
	readonly cardSet = "poker"; // solo para reuse de renderCardsAnsi (no se mira aquí)
	readonly teamBased = false;

	/* ------------------------------------------------------------
	 * Setup
	 * ---------------------------------------------------------- */
	async init(ctx: GameRuntime) {
		ctx.deck = this.createDeck();
		this.shuffle(ctx.deck);

		// 7 cartas a cada jugador
		ctx.players.forEach((p) => (p.hand = ctx.deck.splice(0, 7)));
		// primera carta válida para la mesa
		let first: Card;
		do first = ctx.deck.shift() as Card;
		while (first.value === "W" || first.value === "+4"); // evita wild como primera
		ctx.table = [first];
		ctx.meta = {
			dir: 1, // 1 = horario, -1 = antihorario
			stack: 0, // para +2 y +4 acumulados
			needColor: null as UnoColor | null, // cuando se juega wild/+4
		};
		await sendTable(ctx);
	}

	/* ------------------------------------------------------------
	 * Interacciones por botón
	 * customId:  play_{idx}   /   draw
	 *            color_R|G|B|Y  (tras un wild)
	 * ---------------------------------------------------------- */
	async handleAction(ctx: GameRuntime, uid: string, i: ButtonInteraction): Promise<void> {
		const pid = ctx.players.findIndex((p) => p.id === uid);
		if (pid === -1) {
			await i.reply({ content: "No juegas en esta partida.", ephemeral: true });
			return;
		}

		// elegir color tras wild
		if (i.customId.startsWith("color_")) {
			const color = i.customId.split("_")[1] as UnoColor;
			ctx.meta.needColor = color;
			await i.update({});
			this.advanceTurn(ctx);
			return sendTable(ctx);
		}

		if (i.customId === "draw") {
			const card = ctx.deck.shift() as Card;
			ctx.players[pid].hand.push(card);
			await i.deferUpdate();
			// si robo y NO puede jugar nada, pasa turno
			if (!this.validPlays(ctx, ctx.players[pid]).length) this.advanceTurn(ctx);
			return sendTable(ctx);
		}

		if (i.customId.startsWith("play_")) {
			const idx = parseInt(i.customId.split("_")[1]);
			const player = ctx.players[pid];
			const card = player.hand[idx];
			if (!this.isPlayable(ctx, card)) {
				await i.reply({ content: "Esa carta no puede jugarse ahora.", ephemeral: true });
				return;
			}

			// juega la carta
			player.hand.splice(idx, 1);
			ctx.table.push(card);

			// aplica efectos
			switch (card.value) {
				case "REV":
					if (ctx.players.length > 2) ctx.meta.dir *= -1;
					else this.skipNext(ctx); // en 2 jugadores REV es SKIP
					break;
				case "SKIP":
					this.skipNext(ctx);
					break;
				case "+2":
					ctx.meta.stack += 2;
					this.skipNext(ctx);
					break;
				case "+4":
					ctx.meta.stack += 4;
					ctx.meta.needColor = "X"; // fuerza elegir color
					break;
				case "W":
					ctx.meta.needColor = "X"; // elegir color
					break;
			}

			// ¿fin de juego?
			if (!player.hand.length) {
				ctx.finish(`<@${player.id}>`);
				return;
			}

			// si hay que elegir color, muestra botones de color
			if (ctx.meta.needColor === "X") {
				const row = ["R", "G", "B", "Y"].map((c) =>
					new ButtonBuilder().setCustomId(`color_${c}`).setLabel(c).setStyle(ButtonStyle.Secondary)
				);
				await i.update({ components: [{ type: 1, components: row } as any] });
				return; // sendTable se llamará luego de elegir color
			}

			await i.deferUpdate();
			this.advanceTurn(ctx);
			return sendTable(ctx);
		}
	}

	/* ------------------------------------------------------------
	 * Estado público y choices
	 * ---------------------------------------------------------- */
	publicState(ctx: GameRuntime) {
		const top = ctx.table.at(-1) as Card;
		const col = ctx.meta.needColor && ctx.meta.needColor !== "X" ? ctx.meta.needColor : top.suit;
		const stack = ctx.meta.stack ? `(+${ctx.meta.stack})` : "";
		return `**Carta en mesa:** \`${col} ${top.value}\` ${stack}`;
	}

	playerChoices(ctx: GameRuntime, userId: string) {
		if (ctx.current.id !== userId) return [];
		const player = ctx.current;
		const btns: ButtonBuilder[] = [];

		// cartas jugables
		this.validPlays(ctx, player).forEach(({ idx, card }) =>
			btns.push(new ButtonBuilder().setCustomId(`play_${idx}`).setLabel(`${card.suit} ${card.value}`).setStyle(ButtonStyle.Primary))
		);

		// botón de robar
		btns.push(new ButtonBuilder().setCustomId("draw").setLabel("Robar").setStyle(ButtonStyle.Secondary));
		return btns.slice(0, 25); // Discord ≤ 25
	}

	scoreboard(ctx: GameRuntime) {
		return ctx.players.map((p) => `• <@${p.id}>: ${p.hand.length} carta(s)`).join("\n");
	}

	/* ------------------------------------------------------------
	 * Utilidades privadas
	 * ---------------------------------------------------------- */
	private advanceTurn(ctx: GameRuntime) {
		// si hay stack, el siguiente jugador roba y se limpia
		if (ctx.meta.stack) {
			const next = this.peekNext(ctx);
			const cards = ctx.deck.splice(0, ctx.meta.stack);
			next.hand.push(...cards);
			ctx.meta.stack = 0;
		}
		ctx.nextTurn();
	}

	private skipNext(ctx: GameRuntime) {
		ctx.nextTurn(); // salta uno
		ctx.nextTurn();
	}

	private peekNext(ctx: GameRuntime) {
		const i = (ctx.turnIndex + ctx.meta.dir + ctx.players.length) % ctx.players.length;
		return ctx.players[i];
	}

	private validPlays(ctx: GameRuntime, player: PlayerState) {
		return player.hand.map((card, idx) => ({ card: card, idx })).filter(({ card }) => this.isPlayable(ctx, card));
	}

	private isPlayable(ctx: GameRuntime, card: Card) {
		const top = ctx.table.at(-1) as Card;
		const needColor = ctx.meta.needColor as UnoColor | null;
		if (needColor && needColor !== "X") return card.suit === needColor || card.value === "W" || card.value === "+4";
		return (
			card.suit === top.suit || card.value === top.value || card.suit === "X" // wild
		);
	}

	private createDeck(): Card[] {
		const deck: Card[] = [];
		const colors: UnoColor[] = ["R", "G", "B", "Y"];
		for (const c of colors) {
			deck.push(mk(c, 0)); // un 0 por color
			for (let n = 1; n <= 9; n++) deck.push(mk(c, n), mk(c, n)); // dos 1-9
			for (const v of ["SKIP", "REV", "+2"] as UnoValue[]) deck.push(mk(c, v), mk(c, v)); // dos de cada acción
		}
		for (let i = 0; i < 4; i++) deck.push(mk("X", "W"), mk("X", "+4"));
		return deck;
	}

	private shuffle<T>(a: T[]) {
		for (let i = a.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[a[i], a[j]] = [a[j], a[i]];
		}
	}
}
