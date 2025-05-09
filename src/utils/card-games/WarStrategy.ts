import { Snowflake, ButtonInteraction, ButtonBuilder, ButtonStyle, ActionRowBuilder } from "discord.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { Card, CardSet, GameStrategy, PlayerLimits } from "./IGameStrategy.js";
import { createDeck, POKER_RANK, renderCardsAnsi, shuffle } from "./CardUtils.js";
import { GameRuntime, PlayerState } from "./GameRuntime.js";

interface WarMeta {
	scores: Record<Snowflake, number>;
}

/* ------------------------------------------------------------------
 * "war" (carta más alta gana)
 * ----------------------------------------------------------------*/
class WarStrategy implements GameStrategy<WarMeta> {
	readonly name = "war";
	readonly limits: PlayerLimits = { min: 2, max: 2 };
	readonly cardSet: CardSet = "poker";
	readonly teamBased = false;

	async init(ctx: GameRuntime<WarMeta>) {
		ctx.deck = createDeck(this.cardSet);
		shuffle(ctx.deck);
		ctx.players.forEach((p) => (p.hand = ctx.deck.splice(0, 26)));
		await ctx.sendTable();
	}

	async handleAction(ctx: GameRuntime<WarMeta>, userId: Snowflake, interaction: IPrefixChatInputCommand | ButtonInteraction) {
		if (userId !== ctx.current.id) return;

		const player = ctx.current;
		const card = player.hand.shift();
		if (card) ctx.table.push(card);

		// ¿todos jugaron?
		if (ctx.table.length === ctx.players.length) {
			await ctx.sendTable();
			const winner = WarStrategy.decideWinner(ctx.table, ctx.players);
			setTimeout(async () => {
				ctx.nextTurn(); // ↩️ se avanza el turno
				if (!winner) {
					// empate
					ctx.table = [];
					return await ctx.sendTable();
				}

				const scores = (ctx.meta.scores ??= {} as Record<Snowflake, number>);
				scores[winner.id] = (scores[winner.id] ?? 0) + 1;

				if (scores[winner.id] === 5) return ctx.finish(winner.displayName);

				ctx.table = [];
				await ctx.sendTable();
			}, 2500);
		} else {
			ctx.nextTurn();
			await ctx.sendTable();
		}
	}

	publicState(ctx: GameRuntime<WarMeta>) {
		return renderCardsAnsi(ctx.table, this.cardSet);
	}

	playerChoices(ctx: GameRuntime<WarMeta>, userId: Snowflake) {
		return [
			new ActionRowBuilder<ButtonBuilder>().addComponents([
				new ButtonBuilder().setCustomId(`play-${userId}`).setLabel("Jugar carta").setStyle(ButtonStyle.Primary),
			]),
		];
	}
	scoreboard(ctx: GameRuntime<WarMeta>) {
		const scores = ctx.meta.scores ?? {};
		return ctx.players.map((p) => `<@${p.id}> **${scores[p.id] ?? 0}**`).join(" • ");
	}

	private static decideWinner(table: Card[], players: PlayerState[]) {
		// Asumimos que table[0] pertenece a players[0] y table[1] a players[1]
		const rank = (c: Card) => POKER_RANK.indexOf(c.value);
		const r0 = rank(table[0]);
		const r1 = rank(table[1]);

		if (r0 === r1) return null; // empate ("war" real si querés extender)
		return r0 > r1 ? players[0] : players[1];
	}
}

export default WarStrategy;
