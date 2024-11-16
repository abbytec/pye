import { Schema, Document, model } from "mongoose";

export interface ICommandLimits {
	name: string;
	lowestMoney: number;
	highestMoney: number;
	failRate: number;
	cooldown: number;
}

export interface ICommandLimitsDocument extends ICommandLimits, Document {}

const commandSchema = new Schema<ICommandLimitsDocument>(
	{
		name: {
			type: String,
			required: true,
		},
		lowestMoney: {
			type: Number,
			default: 10,
		},
		highestMoney: {
			type: Number,
			default: 100,
		},
		failRate: {
			type: Number,
			default: 0,
		},
		cooldown: {
			type: Number,
			default: 0, // EN HORAS
		},
	},
	{ versionKey: false }
);

export const CommandLimits = model("Command", commandSchema);
