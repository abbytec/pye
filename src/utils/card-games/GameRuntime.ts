import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Message, RepliableInteraction, Snowflake, ThreadChannel } from "discord.js";
import { Card, GameStrategy } from "./strategies/IGameStrategy.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { COLORS } from "../constants.js";
import { renderCardsAnsi } from "./CardRenderUtils.js";
import { Users } from "../../Models/User.js";

/* ------------------------------------------------------------------
 *  Runtime container passed to every strategy
 * ----------------------------------------------------------------*/
export interface PlayerState {
	id: Snowflake;
	displayName: string;
	hand: Card[];
	team?: 0 | 1;
}

export class GameRuntime<M> {
	public deck: Card[] = [];
	public table: Card[] = [];
	public turnIndex = 0;
	public meta: M = {} as M;
	public tableMessage: Message | null = null;
	public handInts = new Map<Snowflake, RepliableInteraction>();

	constructor(
		public readonly interaction: IPrefixChatInputCommand,
		public readonly thread: ThreadChannel,
		public readonly players: PlayerState[],
		public readonly strategy: GameStrategy<M>,
		public readonly bet: number
	) {}

	nextTurn() {
		this.turnIndex = (this.turnIndex + 1) % this.players.length;
	}

	get current() {
		return this.players[this.turnIndex];
	}

	public async finish(winnerName?: string | null, winnerId?: Snowflake | null, winnerTeam?: number | null) {
		if (this.tableMessage) {
			const title = winnerName == null ? "No hay ganador, tiempo de espera finalizado" : `🏆 ¡Ganó ${winnerName}!`; // 👈 usa el displayName
			if (winnerId) {
				const botId = this.interaction.client.user?.id;
				// Solo actualizar dinero de jugadores humanos
				const humanPlayers = this.players.filter((p) => p.id !== botId);
				const humanWinner = winnerId !== botId;

				if (humanWinner) {
					// Si ganó un humano, darle el premio (solo de jugadores humanos)
					await Users.updateOne({ id: winnerId }, { $inc: { cash: this.bet * humanPlayers.length } });
					await Users.updateMany(
						{ id: { $in: humanPlayers.filter((p) => p.id !== winnerId).map((p) => p.id) } },
						{ $inc: { cash: -this.bet } }
					);
				} else {
					// Si ganó el bot, todos los humanos pierden su apuesta (el bot no cobra)
					await Users.updateMany({ id: { $in: humanPlayers.map((p) => p.id) } }, { $inc: { cash: -this.bet } });
				}
			}
			const embed = new EmbedBuilder().setColor(COLORS.okGreen).setTitle(title).setFooter({ text: "Este hilo se eliminará en 40 s…" });
			await this.tableMessage.edit({ embeds: [embed], components: [] });
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
			content: `**Tus cartas:**\n${renderCardsAnsi(player.hand)}`,
			components: btns.length ? btns : [],
		});
	}
	public async sendTable() {
		const embed = new EmbedBuilder()
			.setColor(COLORS.pyeLightBlue)
			.setTitle(`Juego: ${this.strategy.name}`)
			.setDescription(
				[
					this.strategy.publicState(this),
					this.strategy.scoreboard?.(this), // histórico/puntos
					`**Turno:** <@${this.current.id}>`, // turno actual
				]
					.filter(Boolean)
					.join("\n\n")
			);

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId("show-hand").setLabel("Mostrar tus cartas").setStyle(ButtonStyle.Secondary)
		);

		if (this.tableMessage) await this.tableMessage.edit({ embeds: [embed], components: [row] });
		else this.tableMessage = await this.thread.send({ embeds: [embed], components: [row] });
	}
}
