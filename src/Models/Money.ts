import { Schema, Document, model } from "mongoose";

interface MoneyConfig {
	time: number;
	coins: number;
}

export interface IMoney {
	_id: string;
	bump: number;
	voice: MoneyConfig;
	text: MoneyConfig;
}

export interface IMoneyDocument extends IMoney, Document {
	_id: string;
}

const moneySchema = new Schema<IMoneyDocument>(
	{
		_id: {
			type: String,
			required: true,
		},
		bump: {
			type: Number,
			required: true,
		},
		voice: {
			type: Object,
			required: true,
		},
		text: {
			type: Object,
			required: true,
		},
	},
	{ versionKey: false }
);

export const Money = model("Money", moneySchema);
