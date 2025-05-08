import { Snowflake, ButtonInteraction, ButtonBuilder, ButtonStyle } from "discord.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { Card, CardSet, GameStrategy, PlayerLimits } from "./IGameStrategy.js";
import { createDeck, POKER_RANK, renderCardsAnsi, shuffle } from "./CardUtils.js";
import { GameRuntime, PlayerState, sendTable } from "./GameRuntime.js";

/* ------------------------------------------------------------------
 * "war" (carta más alta gana)
 * ----------------------------------------------------------------*/
class WarStrategy implements GameStrategy {
	readonly name = "war";
	readonly limits: PlayerLimits = { min: 2, max: 2 };
	readonly cardSet: CardSet = "poker";

	async init(ctx: GameRuntime) {
		ctx.deck = createDeck(this.cardSet);
		shuffle(ctx.deck);
		ctx.players.forEach((p) => (p.hand = ctx.deck.splice(0, 26)));
		await sendTable(ctx);
	}

	async handleAction(ctx: GameRuntime, userId: Snowflake, interaction: IPrefixChatInputCommand | ButtonInteraction) {
		if (userId !== ctx.current.id) return;

		const player = ctx.current;
		const card = player.hand.shift();
		if (card) ctx.table.push(card);

		ctx.nextTurn(); // ↩️ se avanza el turno

		await sendTable(ctx); // 🔄 refresca embed: turno correcto + mesa actual

		// ¿todos jugaron?
		if (ctx.table.length === ctx.players.length) {
			const winner = WarStrategy.decideWinner(ctx.table, ctx.players);
			setTimeout(async () => {
				if (!winner) {
					// empate
					ctx.table = [];
					return await sendTable(ctx);
				}

				const scores = (ctx.meta.scores ??= {} as Record<Snowflake, number>);
				scores[winner.id] = (scores[winner.id] ?? 0) + 1;

				if (scores[winner.id] === 5) return ctx.finish(interaction.guild?.members.cache.get(winner.id)?.displayName ?? "");

				ctx.table = [];
				await sendTable(ctx);
			}, 2500);
		}
	}

	publicState(ctx: GameRuntime) {
		return renderCardsAnsi(ctx.table, this.cardSet);
	}

	playerChoices(ctx: GameRuntime, userId: Snowflake) {
		if (userId !== ctx.current.id) return [];
		return [new ButtonBuilder().setCustomId(`play-${userId}`).setLabel("Jugar carta").setStyle(ButtonStyle.Primary)];
	}
	scoreboard(ctx: GameRuntime) {
		const scores = (ctx.meta.scores ?? {}) as Record<Snowflake, number>;
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
