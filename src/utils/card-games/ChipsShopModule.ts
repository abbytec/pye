import { Snowflake, ButtonBuilder, ButtonStyle, ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, ButtonInteraction } from "discord.js";
import { Users } from "../../Models/User.js";
import EconomyService from "../../core/services/EconomyService.js";
import { GameRuntime } from "./GameRuntime.js";

/**
 * Configuración personalizable del módulo de compra de fichas
 */
export interface ChipsShopConfig {
	/** Paquetes disponibles para comprar */
	packages: Array<{ amount: number; label: string }>;
	/** Precio base por ficha (default: 10) */
	pricePerChip?: number;
	/** Campo en meta donde se almacenan las fichas del jugador */
	chipsField: string;
	/** Campo en meta donde se almacenan las apuestas actuales (opcional) */
	betsField?: string;
	/** Callback para validar si puede comprar (ej: no está en fold) */
	canBuyFn?: (ctx: GameRuntime<any>, userId: Snowflake) => boolean;
}

/**
 * Módulo de compra de fichas reutilizable
 * 
 * Uso:
 * - Agregar botón en playerChoices: ChipsShopModule.createShopButton()
 * - Manejar en handleAction: ChipsShopModule.handleChipsShopAction(...)
 */
export class ChipsShopModule {
	/**
	 * Crear configuración por defecto
	 */
	static createDefaultConfig(chipsField: string = "chips"): ChipsShopConfig {
		return {
			packages: [
				{ amount: 100, label: "100 fichas" },
				{ amount: 250, label: "250 fichas" },
				{ amount: 500, label: "500 fichas" },
				{ amount: 1000, label: "1000 fichas" },
				{ amount: 2500, label: "2500 fichas" },
			],
			pricePerChip: 10,
			chipsField,
		};
	}

	/**
	 * Crear el botón "Comprar fichas"
	 */
	static createShopButton(): ButtonBuilder {
		return new ButtonBuilder()
			.setCustomId("open-shop")
			.setLabel("💰 Comprar fichas")
			.setStyle(ButtonStyle.Secondary);
	}

	/**
	 * Crear menú select de la tienda
	 */
	private static createShopMenu(config: ChipsShopConfig, userCash: number): StringSelectMenuBuilder {
		const options = config.packages.map((pkg) => {
			const cost = EconomyService.getInflatedRate((pkg.amount * (config.pricePerChip ?? 10)));
			const canAfford = userCash >= cost;
			return {
				label: pkg.label,
				description: `${cost} coins ${!canAfford ? "❌ Sin dinero" : ""}`,
				value: `buy-chips-${pkg.amount}`,
				emoji: canAfford ? "💰" : "❌",
			};
		});

		return new StringSelectMenuBuilder()
			.setCustomId("chips-shop")
			.setPlaceholder("Selecciona un paquete de fichas")
			.setOptions(options);
	}

	/**
	 * Verificar si una acción es del sistema de tienda
	 */
	static isShopAction(customId: string): boolean {
		return (
			customId === "open-shop" ||
			customId === "chips-shop" ||
			customId.startsWith("buy-chips-")
		);
	}

	/**
	 * Manejar acciones del sistema de tienda
	 * 
	 * @param ctx Runtime del juego
	 * @param userId ID del usuario
	 * @param interaction Interacción (Button o StringSelectMenu)
	 * @param config Configuración de la tienda
	 * @returns true si fue manejado, false si no
	 */
	static async handleChipsShopAction(
		ctx: GameRuntime<any>,
		userId: Snowflake,
		interaction: ButtonInteraction | StringSelectMenuInteraction,
		config: ChipsShopConfig
	): Promise<boolean> {
		const customId = interaction.customId;

		// Manejar apertura de tienda
		if (customId === "open-shop") {
			// Validación personalizada
			if (config.canBuyFn && !config.canBuyFn(ctx, userId)) {
				await interaction.followUp({
					content: "❌ No puedes comprar fichas en este momento.",
					ephemeral: true,
				});
				return true;
			}

			const user = await Users.findOne({ id: userId });
			if (!user) {
				await interaction.followUp({
					content: "❌ No pudimos obtener tu información.",
					ephemeral: true,
				});
				return true;
			}

			const selectMenu = this.createShopMenu(config, user.cash ?? 0);
			const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

			await interaction.followUp({
				content: `**Tienda de Fichas**\n💵 Dinero disponible: **${user.cash ?? 0}** coins`,
				components: [row],
				ephemeral: true,
			});
			return true;
		}

		// Manejar selección de menú
		if (customId === "chips-shop" && "values" in interaction) {
			const selectedValue = (interaction as StringSelectMenuInteraction).values[0];

			if (!selectedValue.startsWith("buy-chips-")) {
				return false;
			}

			const chipsAmount = parseInt(selectedValue.split("-")[2]);

			const user = await Users.findOne({ id: userId });
			if (!user) {
				await interaction.followUp({
					content: "❌ No pudimos obtener tu información.",
					ephemeral: true,
				});
				return true;
			}

			const cost = EconomyService.getInflatedRate(chipsAmount * (config.pricePerChip ?? 10));
			if ((user.cash ?? 0) < cost) {
				await interaction.followUp({
					content: `❌ No tienes suficiente dinero. Necesitas **${cost}** coins, tienes **${user.cash ?? 0}**.`,
					ephemeral: true,
				});
				return true;
			}

			// Actualizar fichas
			const chipsRecord: Record<Snowflake, number> = ctx.meta[config.chipsField] ?? {};
			chipsRecord[userId] = (chipsRecord[userId] ?? 0) + chipsAmount;
			ctx.meta[config.chipsField] = chipsRecord;

			// Deducir dinero
			await Users.updateOne({ id: userId }, { $inc: { cash: -cost } });

			await interaction.followUp({
				content: `✅ ¡Compraste **${chipsAmount}** fichas por **${cost}** coins!`,
				ephemeral: true,
			});
			return true;
		}

		// Compra directa (en caso de ser llamada por botón)
		if (customId.startsWith("buy-chips-")) {
			const chipsAmount = parseInt(customId.split("-")[2]);

			const user = await Users.findOne({ id: userId });
			if (!user) {
				await interaction.followUp({
					content: "❌ No pudimos obtener tu información.",
					ephemeral: true,
				});
				return true;
			}

			const cost = EconomyService.getInflatedRate(chipsAmount * (config.pricePerChip ?? 10));
			if ((user.cash ?? 0) < cost) {
				await interaction.followUp({
					content: `❌ No tienes suficiente dinero. Necesitas **${cost}** coins, tienes **${user.cash ?? 0}**.`,
					ephemeral: true,
				});
				return true;
			}

			// Actualizar fichas
			const chipsRecord: Record<Snowflake, number> = ctx.meta[config.chipsField] ?? {};
			chipsRecord[userId] = (chipsRecord[userId] ?? 0) + chipsAmount;
			ctx.meta[config.chipsField] = chipsRecord;

			// Deducir dinero
			await Users.updateOne({ id: userId }, { $inc: { cash: -cost } });

			await interaction.followUp({
				content: `✅ ¡Compraste **${chipsAmount}** fichas por **${cost}** coins!`,
				ephemeral: true,
			});
			return true;
		}

		return false;
	}

	/**
	 * Agregar botón de tienda a un array de ActionRowBuilders existentes
	 */
	static addShopButtonToRows(rows: ActionRowBuilder<any>[]): ActionRowBuilder<any>[] {
		const shopButton = this.createShopButton();
		const result = [new ActionRowBuilder<ButtonBuilder>().addComponents(shopButton), ...rows];
		return result;
	}
}

export default ChipsShopModule;
