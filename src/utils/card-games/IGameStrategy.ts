import { ButtonBuilder, ButtonInteraction, Snowflake } from "discord.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { GameRuntime } from "./GameRuntime.js";

/* ------------------------------------------------------------------
 *  Generic card & game domain types
 * ----------------------------------------------------------------*/
export interface Card {
	suit: string; // ♥ ♦ ♣ ♠ or spanish equivalents
	value: string | number; // A-K or 1-12 + figuras
}

export type CardSet = "poker" | "spanish";

export interface PlayerLimits {
	min: number;
	max?: number;
	exact?: number[]; // explicit allowed sizes (e.g. UNO = [2,3,4]
}

export interface GameStrategy {
	readonly name: string;
	readonly limits: PlayerLimits;
	readonly cardSet: CardSet;

	/** Called once per game to prepare deck / hands / metadata  */
	init(ctx: GameRuntime): Promise<void>;
	/** Any interaction emitted by a player (button, select, etc.)  */
	handleAction(ctx: GameRuntime, userId: Snowflake, interaction: IPrefixChatInputCommand | ButtonInteraction): Promise<void>;
	/** ANSI representation of public table state */
	publicState(ctx: GameRuntime): string;
	/** Optional extra buttons that only the user can see when it's their turn */
	playerChoices?(ctx: GameRuntime, userId: Snowflake): ButtonBuilder[];
	/** Texto con el histórico/score actual (opcional) */
	scoreboard?(ctx: GameRuntime): string;
}
