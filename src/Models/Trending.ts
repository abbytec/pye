// Importaciones necesarias
import { name } from "agenda/dist/agenda/name.js";
import mongoose, { Schema, Document, Model } from "mongoose";
import { COLORS } from "../utils/constants.js";
import { error } from "winston";
import { ExtendedClient } from "../client.js";

interface TrendingDocument extends Document {
	emojis: Map<string, number>;
	channels: Map<string, number>;
	stickers: Map<string, number>;
	month: number;
}

// Definición del esquema de Mongoose
const TrendingSchema = new Schema({
	emojis: {
		type: Map,
		of: Number,
		default: {},
	},
	channels: {
		type: Map,
		of: Number,
		default: {},
	},
	stickers: {
		type: Map,
		of: Number,
		default: {},
	},
	month: {
		type: Number,
		default: new Date().getMonth(),
	},
});

// Creación del modelo de Mongoose
const TrendingModel: Model<TrendingDocument> = mongoose.model<TrendingDocument>("Trending", TrendingSchema);

type TrendingType = "emoji" | "threadPost" | "sticker";

// Implementación de la clase Trending
class Trending {
	emojis: Map<string, number>;
	forumChannels: Map<string, number>;
	stickers: Map<string, number>;
	month: number;

	// Factores de decaimiento
	private readonly DECAY_FACTOR_EMOJI: number = 0.99;
	private readonly DECAY_FACTOR_CHANNEL: number = 0.99;
	private readonly DECAY_FACTOR_STICKER: number = 0.99;
	private readonly DAILY_DECAY_FACTOR_EMOJI: number = 0.9;
	private readonly DAILY_DECAY_FACTOR_CHANNEL: number = 0.9;
	private readonly DAILY_DECAY_FACTOR_STICKER: number = 0.9;

	constructor() {
		// Inicialización de los mapas y mes actual
		this.emojis = new Map<string, number>();
		this.forumChannels = new Map<string, number>();
		this.stickers = new Map<string, number>();
		this.month = new Date().getMonth();
	}

	private filterEmojis(emojis: Map<string, number>, allEmojis: string[]): Map<string, number> {
		const idMapper = new Map();
		for (const emoji of allEmojis) {
			idMapper.set(emoji.replace(/w+|:/g, ""), emoji);
		}
		const filtered = new Map<string, number>();
		for (const [emoji, score] of emojis.entries()) {
			if (emoji.match(/\w+:\d+/g) && score > 0) {
				filtered.set(emoji, score);
			} else if (emoji.match(/d{3,}/g) && score > 0) {
				const id = idMapper.get(emoji);
				if (id) {
					filtered.set(idMapper.get(emoji), score);
				}
			}
		}
		return filtered;
	}

	// Método para cargar datos desde la base de datos y aceptar listas de IDs
	async load(emojiIds: string[], stickerIds: string[], channelIds: string[]): Promise<void> {
		let data = await TrendingModel.findOne();
		if (data) {
			data.channels.delete("");
			data.stickers.delete("");
			this.emojis = this.filterEmojis(data.emojis, emojiIds);
			this.forumChannels = new Map(data.channels);
			this.stickers = new Map(data.stickers);
			this.month = data.month;
		}

		// Asegura que todos los IDs estén presentes en los mapas con valor inicial 0
		for (const id of emojiIds) {
			if (id && !this.emojis.has(id)) {
				this.emojis.set(id, 0);
			}
		}

		for (const id of stickerIds) {
			if (id && !this.stickers.has(id)) {
				this.stickers.set(id, 0);
			}
		}

		for (const id of channelIds) {
			if (id && !this.forumChannels.has(id)) {
				this.forumChannels.set(id, 0);
			}
		}

		await this.dailySave();
	}

	// Método para guardar datos en la base de datos
	public async dailySave(): Promise<void> {
		let data = await TrendingModel.findOne();
		if (!data) data = await TrendingModel.create({});
		if (
			data.emojis !== this.emojis ||
			data.channels !== this.forumChannels ||
			data.stickers !== this.stickers ||
			data.month !== this.month
		) {
			data.emojis = this.emojis;
			data.channels = this.forumChannels;
			data.stickers = this.stickers;
			data.month = this.month;

			await data.save().catch((error) => {
				ExtendedClient.logError(
					"Error al guardar los datos diarios de Trending: " +
						error.message +
						"\nthis.emojis:" +
						JSON.stringify(this.emojis) +
						"\nthis.forumChannels:" +
						JSON.stringify(this.forumChannels) +
						"\nthis.stickers:" +
						JSON.stringify(this.stickers),
					error.stack,
					process.env.CLIENT_ID
				);
			});
		}

		this.decay();
	}

	// Método para agregar uso a un emoji, canal o sticker
	public add(type: TrendingType, id: string): void {
		let map: Map<string, number>;
		let factor: number;

		if (!id) return;

		switch (type) {
			case "emoji":
				map = this.emojis;
				factor = this.DECAY_FACTOR_EMOJI;
				break;
			case "threadPost":
				map = this.forumChannels;
				factor = this.DECAY_FACTOR_CHANNEL;
				break;
			case "sticker":
				map = this.stickers;
				factor = this.DECAY_FACTOR_STICKER;
				break;
			default:
				throw new Error("Tipo inválido");
		}

		this.decayMap(map, factor);

		const newValue = (map.get(id) ?? 0) + 1;

		map.set(id, newValue);
	}

	// Método para aplicar decaimiento a todos los mapas
	private decay(): void {
		this.decayMap(this.emojis, this.DAILY_DECAY_FACTOR_EMOJI);
		this.decayMap(this.forumChannels, this.DAILY_DECAY_FACTOR_CHANNEL);
		this.decayMap(this.stickers, this.DAILY_DECAY_FACTOR_STICKER);
	}

	// Método privado para aplicar decaimiento a un mapa específico
	private decayMap(map: Map<string, number>, decayFactor: number): void {
		for (const [key, value] of map.entries()) {
			map.set(key, value * decayFactor);
		}
	}

	// Método para obtener estadísticas y reiniciar si el mes ha cambiado
	public async getStats(client: ExtendedClient): Promise<any> {
		const currentMonth = new Date().getMonth();
		if (this.month !== currentMonth) {
			this.resetStatistics();
			this.month = currentMonth;
		}

		// Construir el embed en formato JSON
		const embed = {
			title: "Estadísticas Mensuales de Tendencias",
			color: COLORS.pyeLightBlue,
			fields: [
				{
					name: "🥇 Top 3 Emojis en Tendencia",
					value:
						this.getTop("emoji", 3)
							.map((item) => `<:${item.id}>`)
							.join("\n") || "No hay datos",
					inline: true,
				},
				{
					name: "🔻 3 Emojis con Menor Tendencia",
					value: (await this.getBottom("emoji", client, 3)).map((item) => `<:${item.id}>`).join("\n") || "No hay datos",
					inline: true,
				},
				{
					name: "🚫 3 Emojis No Utilizados",
					value:
						this.getUnused("emoji")
							.map((id) => `<:${id}>`)
							.join(", ") || "Ninguno",
				},
				{
					name: "🥇 Top 3 Foros en Tendencia",
					value:
						this.getTop("threadPost", 3)
							.map((item) => `<#${item.id}>`)
							.join("\n") || "No hay datos",
					inline: true,
				},
				{
					name: "🔻 3 Foros con Menor Tendencia",
					value: (await this.getBottom("threadPost", client, 3)).map((item) => `<#${item.id}>`).join("\n") || "No hay datos",
					inline: true,
				},
				{
					name: "🚫 3 Foros No Utilizados",
					value:
						this.getUnused("threadPost")
							.map((id) => `<#${id}>`)
							.join(", ") || "Ninguno",
				},
				{
					name: "🥇 Top 3 Stickers en Tendencia",
					value:
						this.getTop("sticker", 3)
							.map((item) => `**${item.id}**`)
							.join("\n") || "No hay datos",
					inline: true,
				},
				{
					name: "🔻 3 Stickers con Menor Tendencia",
					value: (await this.getBottom("sticker", client, 3)).map((item) => `**${item.id}**`).join("\n") || "No hay datos",
					inline: true,
				},
				{
					name: "🚫 3 Stickers No Utilizados",
					value:
						this.getUnused("sticker")
							.map((id) => `**${id}**`)
							.join(", ") || "Ninguno",
				},
			],
			timestamp: new Date(),
		};
		return embed;
	}

	// Método para reiniciar estadísticas a cero
	private resetStatistics(): void {
		this.resetMap(this.emojis);
		this.resetMap(this.forumChannels);
		this.resetMap(this.stickers);
	}

	private resetMap(map: Map<string, number>): void {
		for (const key of map.keys()) {
			map.set(key, 0);
		}
	}

	// Métodos para obtener los top y bottom n elementos
	private getTop(type: TrendingType, count: number = 3): { id: string; score: number }[] {
		const map = this.getMapByType(type);
		const entries = Array.from(map.entries());
		entries.sort((a, b) => b[1] - a[1]); // Orden descendente
		return entries.slice(0, count).map(([id, score]) => ({ id, score }));
	}

	private async getBottom(type: TrendingType, client: ExtendedClient, count: number = 3): Promise<{ id: string; score: number }[]> {
		const map = this.getMapByType(type);
		let entries = Array.from(map.entries());
		if (type === "emoji") {
			const svEmojis = await client.guilds.cache.get(process.env.GUILD_ID ?? "")?.emojis.fetch();
			if (svEmojis) entries = entries.filter(([id]) => svEmojis.has(id));
		} else if (type === "sticker") {
			const svStickers = await client.guilds.cache.get(process.env.GUILD_ID ?? "")?.stickers.fetch();
			if (svStickers) entries = entries.filter(([id]) => svStickers.has(id));
		}
		entries.sort((a, b) => a[1] - b[1]); // Orden descendente
		return entries
			.filter(([, score]) => score > 0)
			.slice(0, count)
			.map(([id, score]) => ({ id, score }));
	}

	// Método para obtener elementos no utilizados
	private getUnused(type: TrendingType, count: number = 3): string[] {
		const map = this.getMapByType(type);
		const unused = [];
		for (const [id, score] of map.entries()) {
			if (score === 0) {
				unused.push(id);
			}
		}
		unused.sort(() => Math.random() - 0.5);
		return unused.slice(0, count);
	}

	// Método privado para obtener el mapa según el tipo
	private getMapByType(type: TrendingType): Map<string, number> {
		switch (type) {
			case "emoji":
				return this.emojis;
			case "threadPost":
				return this.forumChannels;
			case "sticker":
				return this.stickers;
			default:
				throw new Error("Tipo inválido");
		}
	}
}

export default Trending;
