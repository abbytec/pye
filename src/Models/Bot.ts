import { Schema, Document, model } from "mongoose";

export interface IBot {
	id: string;
	disabled: boolean;
}

export interface IBotDocument extends IBot, Document {
	id: string;
}
const botSchema = new Schema<IBotDocument>(
	{
		id: {
			type: String,
			required: true,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
	},
	{ versionKey: false }
);

export const Bot = model("Bot", botSchema);
