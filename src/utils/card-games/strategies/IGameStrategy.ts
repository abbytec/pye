import { ActionRowBuilder, ButtonInteraction, Snowflake, StringSelectMenuInteraction } from "discord.js";
import { IPrefixChatInputCommand } from "../../../interfaces/IPrefixChatInputCommand.js";
import { GameRuntime } from "../GameRuntime.js";
import { PokerSuit, PokerValue, SpanishSuit, SpanishValue, UnoSuit, UnoValue } from "../DeckFactory.js";

/* ------------------------------------------------------------------
 *  Generic card & game domain types
 * ----------------------------------------------------------------*/
export interface Card {
	suit: PokerSuit | SpanishSuit | UnoSuit; // ♥ ♦ ♣ ♠ or spanish equivalents
	value: PokerValue | SpanishValue | UnoValue; // A-K or 1-12 + figuras
}

export type CardSet = "poker" | "spanish" | "uno";

export interface PlayerLimits {
	min: number;
	max?: number;
	exact?: number[]; // explicit allowed sizes (e.g. UNO = [2,3,4]
}

export interface GameStrategy<StrategyMeta> {
	readonly name: string;
	readonly limits: PlayerLimits;
	readonly cardSet: CardSet;
	readonly teamBased: boolean;

	/** Called once per game to prepare deck / hands / metadata  */
	init(ctx: GameRuntime<StrategyMeta>): Promise<void>;
	/** 
	 * Any interaction emitted by a player (button, select, etc.)
	 * 
	 * IMPORTANTE: Los customIds de botones pueden usar prefijos especiales:
	 * - "respond_" : Acción de respuesta que NO requiere ser el turno actual (ej: respond_yes, respond_no)
	 *   La validación de quién puede responder la maneja la estrategia en handleAction()
	 * - "play_"   : Acciones normales que sí requieren ser el turno actual
	 * - Otros     : Acciones normales que requieren ser el turno actual
	 */
	handleAction(ctx: GameRuntime<StrategyMeta>, userId: Snowflake, interaction: IPrefixChatInputCommand | ButtonInteraction | StringSelectMenuInteraction): Promise<void>;
	/** ANSI representation of public table state */
	publicState(ctx: GameRuntime<StrategyMeta>): string;
	/** Optional extra buttons that only the user can see when it's their turn */
	playerChoices?(ctx: GameRuntime<StrategyMeta>, userId: Snowflake): ActionRowBuilder<any>[];
	/** Texto con el histórico/score actual (opcional) */
	scoreboard?(ctx: GameRuntime<StrategyMeta>): string;
	/** Toma automática de decisión para el bot (cuando es su turno). Retorna el customId del botón que presionaría */
	botDecision?(ctx: GameRuntime<StrategyMeta>, botUserId: Snowflake): Promise<string | null>;
}
