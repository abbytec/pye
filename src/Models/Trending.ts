// Importaciones necesarias
import mongoose, { Schema, Document, Model } from "mongoose";

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
export const TrendingModel: Model<TrendingDocument> = mongoose.model<TrendingDocument>("Trending", TrendingSchema);
