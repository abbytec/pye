import { Schema, model } from "mongoose";

interface IStarMessage {
	msgId: string;
	responseId: string;
}

export interface IStarMessageDocument extends IStarMessage, Document {}

const schemaStarMessage: Schema<IStarMessageDocument> = new Schema(
	{
		msgId: {
			type: String,
			required: true,
		},
		responseId: {
			type: String,
			required: true,
		},
	},
	{ versionKey: false }
);

export const StarMessage = model("StarMessage", schemaStarMessage);
