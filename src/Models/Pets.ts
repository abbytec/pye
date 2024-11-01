import { Schema, model } from "mongoose";

interface IPet {
	id: string;
	name: string;
	food: number;
	mood: number;
	shower: number;
}

export interface IPetDocument extends IPet, Document {}

const petSchema = new Schema<IPetDocument>(
	{
		id: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			default: "none",
		},
		food: {
			type: Number,
			default: 100,
		},
		mood: {
			type: Number,
			default: 100,
		},
		shower: {
			type: Number,
			default: 100,
		},
	},
	{ versionKey: false }
);

export const Pets = model("Pets", petSchema);
