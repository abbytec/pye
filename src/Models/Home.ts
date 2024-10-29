import { Schema, model } from "mongoose";

interface IHomhe {
	id: string;
	name: string;
	money: number;
	bump: number;
	text: number;
	rep: number;
	pet: string;
	level: number;
	house: {
		level: number;
		color: string;
	};
	active: boolean;
	monthly: number;
}

export interface IHomeDocument extends IHomhe, Document {}

const schemaHome = new Schema<IHomeDocument>(
	{
		id: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: false,
		},
		money: {
			type: Number,
			default: 0,
		},
		bump: {
			type: Number,
			default: 0,
		},
		text: {
			type: Number,
			default: 0,
		},
		rep: {
			type: Number,
			default: 0,
		},
		pet: {
			type: String,
			default: "none",
		},
		level: {
			type: Number,
			default: 1,
		},
		house: {
			type: Object,
			default: {
				level: 1,
				color: "Blanco",
			},
		},
		active: {
			type: Boolean,
			default: false,
		},
		monthly: {
			type: Number,
			default: 0,
		},
	},
	{ versionKey: false }
);
export const Home = model("Home", schemaHome);
