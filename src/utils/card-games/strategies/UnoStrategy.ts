// src/utils/card-games/UnoStrategy.ts
import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, Snowflake } from "discord.js";
import { GameRuntime, PlayerState } from "../GameRuntime.js";
import { Card, GameStrategy } from "./IGameStrategy.js";
import { ansiCard } from "../CardRenderUtils.js";
import { DeckFactory, UnoSuit } from "../DeckFactory.js";

interface UnoMeta {
	dir: number;
	stack: number;
	needColor: UnoSuit | null;
	drew: boolean;
}

// ──────────────────────────────────────────────────────────────────
//  Estrategia UNO
// ──────────────────────────────────────────────────────────────────
export default class UnoStrategy implements GameStrategy<UnoMeta> {
	readonly name = "Uno";
	readonly limits = { min: 2, max: 10 };
	readonly cardSet = "uno";
	readonly teamBased = false;

	/* ------------------------------------------------------------
	 * Setup
	 * ---------------------------------------------------------- */
	async init(ctx: GameRuntime<UnoMeta>) {
		ctx.deck = DeckFactory.uno();

		// 7 cartas a cada jugador
		ctx.players.forEach((p) => (p.hand = ctx.deck.splice(0, 7)));
		// primera carta válida para la mesa
		let first: Card;
		do first = ctx.deck.shift() as Card;
		while (first.value === "COLOR" || first.value === "+4"); // evita wild como primera
		ctx.table = [first];
		ctx.meta = {
			dir: 1, // 1 = horario, -1 = antihorario
			stack: 0, // para +2 y +4 acumulados
			needColor: null as UnoSuit | null, // cuando se juega wild/+4
			drew: false,
		};
		await ctx.sendTable();
	}

	/* ------------------------------------------------------------
	 * Interacciones por botón
	 * customId:  play_{idx}   /   draw
	 *            color_R|G|B|Y  (tras un wild)
	 * ---------------------------------------------------------- */
	async handleAction(ctx: GameRuntime<UnoMeta>, uid: string, i: ButtonInteraction): Promise<void> {
		const pid = ctx.players.findIndex((p) => p.id === uid);
		if (pid === -1) {
			await i.reply({ content: "No juegas en esta partida.", ephemeral: true });
			return;
		}

		// elegir color tras wild
		if (i.customId.startsWith("color_")) {
			const color = i.customId.split("_")[1] as UnoSuit;
			ctx.meta.needColor = color;
			await i.update({});
			await this.advanceTurn(ctx);
			const next = this.peekNext(ctx);
			await ctx.refreshHand(next.id);
			return ctx.sendTable();
		}

		if (i.customId === "draw") {
			ctx.meta.drew = true;
			const card = ctx.deck.shift() as Card;
			ctx.players[pid].hand.push(card);
			await i.deferUpdate();
			// si robo y NO puede jugar nada, pasa turno
			if (!this.validPlays(ctx, ctx.players[pid]).length) await this.advanceTurn(ctx);
			await ctx.refreshHand(uid);
			return ctx.sendTable();
		}

		if (i.customId === "pass") {
			await i.deferUpdate();
			await this.advanceTurn(ctx);
			return ctx.sendTable();
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

			if (ctx.meta.needColor && ctx.meta.needColor !== "X" && card.suit !== "X") {
				ctx.meta.needColor = null;
			}

			// aplica efectos
			switch (card.value) {
				case "REV":
					if (ctx.players.length > 2) ctx.meta.dir *= -1;
					else {
						// en 2 jugadores REV es SKIP
						await i.deferUpdate();
						if (!player.hand.length) {
							ctx.finish(`<@${player.id}>`);
							return;
						}
						await this.skipNext(ctx);
						return ctx.sendTable();
					}
					break;
				case "SKIP":
					await i.deferUpdate();
					if (!player.hand.length) {
						ctx.finish(`<@${player.id}>`);
						return;
					}
					await this.skipNext(ctx);
					return ctx.sendTable();
				case "+2":
					ctx.meta.stack += 2;
					break;
				case "+4":
					ctx.meta.stack += 4;
					ctx.meta.needColor = "X"; // fuerza elegir color
					break;
				case "COLOR":
					ctx.meta.needColor = "X"; // elegir color
					break;
			}

			// ¿fin de juego?
			if (!player.hand.length) {
				await i.deferUpdate();
				ctx.finish(player.displayName); // 👈
				return;
			}

			// si hay que elegir color, muestra botones de color
			if (ctx.meta.needColor === "X") {
				const row = ["🟥", "🟩", "🟦", "🟨"].map((c) =>
					new ButtonBuilder().setCustomId(`color_${c}`).setLabel(c).setStyle(ButtonStyle.Secondary)
				);
				await i.update({ components: [{ type: 1, components: row } as any] });
				return; // sendTable se llamará luego de elegir color
			}
			await i.deferUpdate();
			await this.advanceTurn(ctx);
			return ctx.sendTable();
		}
	}

	/* ------------------------------------------------------------
	 * Estado público y choices
	 * ---------------------------------------------------------- */
	publicState(ctx: GameRuntime<UnoMeta>) {
		const top = ctx.table.at(-1) as Card;

		// si se eligió color tras un wild, mostramos ese color
		const effSuit = ctx.meta.needColor && ctx.meta.needColor !== "X" ? ctx.meta.needColor : top.suit;
		const stack = ctx.meta.stack ? ` (+${ctx.meta.stack})` : "";

		return "**Carta en mesa:**\n```ansi\n" + ansiCard({ suit: effSuit, value: top.value }, "uno") + stack + "\n```";
	}

	playerChoices(ctx: GameRuntime<UnoMeta>, userId: Snowflake) {
		if (ctx.current.id !== userId) return [];

		const player = ctx.current;
		const playable = this.validPlays(ctx, player); // cartas que sí se pueden bajar
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];
		const CHUNK = 5; // máx. botones por fila

		/* ---- genera un botón por carta ---- */
		const buttons = playable
			.slice(0, 24)
			.map(({ idx, card }) =>
				new ButtonBuilder().setCustomId(`play_${idx}`).setLabel(`${card.value} ${card.suit}`).setStyle(ButtonStyle.Secondary)
			);

		/* ---- corta en trozos de 5 y arma filas ---- */
		for (let i = 0; i < buttons.length; i += CHUNK) {
			rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(i, i + CHUNK)));
		}

		/* ---- botón "Robar" (si ya hay 5 filas lo agrega a la última) ---- */
		const drawOrPass = ctx.meta.drew
			? new ButtonBuilder().setCustomId("pass").setLabel("Paso").setStyle(ButtonStyle.Secondary)
			: new ButtonBuilder().setCustomId("draw").setLabel("Robar").setStyle(ButtonStyle.Secondary);

		if (rows.length < 5) {
			rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(drawOrPass));
		} else {
			rows[rows.length - 1].addComponents(drawOrPass);
		}

		return rows;
	}

	scoreboard(ctx: GameRuntime<UnoMeta>) {
		return ctx.players.map((p) => `• <@${p.id}>: ${p.hand.length} carta(s)`).join("\n");
	}

	/* ------------------------------------------------------------
	 * Utilidades privadas
	 * ---------------------------------------------------------- */
	private async advanceTurn(ctx: GameRuntime<UnoMeta>) {
		const prevId = ctx.current.id; // ← jugador que terminó su turno

		/* — robos acumulados — */
		if (ctx.meta.stack) {
			const victim = this.peekNext(ctx);
			victim.hand.push(...ctx.deck.splice(0, ctx.meta.stack));
			ctx.meta.stack = 0;
			await ctx.refreshHand(victim.id); // muestra robo al afectado
		}
		ctx.meta.drew = false;
		ctx.nextTurn(); // avanza el turno

		await ctx.refreshHand(prevId); // ← oculta botones del que ya jugó
		await ctx.refreshHand(ctx.current.id); // ← muestra botones al nuevo turno
	}

	private async skipNext(ctx: GameRuntime<UnoMeta>) {
		ctx.nextTurn(); // salta uno
		await this.advanceTurn(ctx);
	}

	private peekNext(ctx: GameRuntime<UnoMeta>) {
		const i = (ctx.turnIndex + ctx.meta.dir + ctx.players.length) % ctx.players.length;
		return ctx.players[i];
	}

	private validPlays(ctx: GameRuntime<UnoMeta>, player: PlayerState) {
		return player.hand.map((card, idx) => ({ card: card, idx })).filter(({ card }) => this.isPlayable(ctx, card));
	}

	private isPlayable(ctx: GameRuntime<UnoMeta>, card?: Card) {
		const top = ctx.table.at(-1) as Card;
		const needColor = ctx.meta.needColor;
		if (needColor && needColor !== "X") return card?.suit === needColor || card?.value === "COLOR" || card?.value === "+4";
		return (
			card?.suit === top.suit || card?.value === top.value || card?.suit === "X" // wild
		);
	}
}
