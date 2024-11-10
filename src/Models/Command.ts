import { Schema, Document, model } from "mongoose";

interface ICommand {
	name: string;
	lowestMoney: number;
	highestMoney: number;
	failRate: number;
	cooldown: number;
}

export interface ICommandDocument extends ICommand, Document {}

const commandSchema = new Schema<ICommandDocument>(
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

export const Command = model("Command", commandSchema);
