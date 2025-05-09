import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, RepliableInteraction, Snowflake, ThreadChannel } from "discord.js";
import { Card, GameStrategy } from "./IGameStrategy.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { COLORS } from "../constants.js";
import { renderCardsAnsi } from "./CardUtils.js";

/* ------------------------------------------------------------------
 *  Runtime container passed to every strategy
 * ----------------------------------------------------------------*/
export interface PlayerState {
	id: Snowflake;
	hand: Card[];
	team?: 0 | 1;
}

export class GameRuntime {
	public deck: Card[] = [];
	public table: Card[] = [];
	public turnIndex = 0;
	public meta: Record<string, any> = {};
	public tableMessage: Message | null = null;
	public handInts = new Map<Snowflake, RepliableInteraction>();

	constructor(
		public readonly interaction: IPrefixChatInputCommand,
		public readonly thread: ThreadChannel,
		public readonly players: PlayerState[],
		public readonly strategy: GameStrategy
	) {}

	nextTurn() {
		this.turnIndex = (this.turnIndex + 1) % this.players.length;
	}

	get current() {
		return this.players[this.turnIndex];
	}

	public finish(winner?: string | null) {
		if (this.tableMessage) {
			let winnerMsg = "";
			if (winner) winnerMsg = `🏆 ¡Ganó ${winner}!`;
			else winnerMsg = winner == null ? "No hay ganador, tiempo de espera finalizado" : `🏆 ¡Ganó ${winner}!`;
			const embed = new EmbedBuilder().setColor(COLORS.okGreen).setTitle(winnerMsg).setFooter({ text: "Este hilo se eliminará en 40 s…" });

			this.tableMessage.edit({ embeds: [embed], components: [] });
		}
		setTimeout(() => this.thread.delete().catch(() => {}), 40_000);
	}

	async refreshHand(userId: Snowflake) {
		const inter = this.handInts.get(userId);
		if (!inter) return;

		const player = this.players.find((p) => p.id === userId);
		if (!player) return;

		const btns = this.strategy.playerChoices?.(this, userId) ?? [];

		await inter.editReply({
			content: renderCardsAnsi(player.hand, this.strategy.cardSet),
			components: btns.length ? btns : [],
		});
	}
}
export async function sendTable(ctx: GameRuntime) {
	const embed = new EmbedBuilder()
		.setColor(COLORS.pyeLightBlue)
		.setTitle(`Juego: ${ctx.strategy.name}`)
		.setDescription(
			[
				ctx.strategy.publicState(ctx),
				ctx.strategy.scoreboard?.(ctx), // histórico/puntos
				`**Turno:** <@${ctx.current.id}>`, // turno actual
			]
				.filter(Boolean)
				.join("\n\n")
		);

	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId("show-hand").setLabel("Mostrar tus cartas").setStyle(ButtonStyle.Secondary)
	);

	if (ctx.tableMessage) await ctx.tableMessage.edit({ embeds: [embed], components: [row] });
	else ctx.tableMessage = await ctx.thread.send({ embeds: [embed], components: [row] });
}
