import { Document, Schema, model } from "mongoose";

interface IStarBoard {
	id: string;
	channel: string;
	stars: number;
}

export interface IStarBoardDocument extends IStarBoard, Document {
	id: string;
}

const schemaStarBoard = new Schema<IStarBoardDocument>(
	{
		id: {
			type: String,
			required: true,
		},
		channel: {
			type: String,
			required: true,
		},
		stars: {
			type: Number,
			default: 4,
		},
	},
	{ versionKey: false }
);

export const StarBoard = model("StarBoard", schemaStarBoard);
