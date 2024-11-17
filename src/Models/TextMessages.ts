import { Document, Schema, model } from "mongoose";

interface ITextMessages {
	id: string;
	channelId: string;
	messages: number;
}

export interface ITextMessagesDocument extends ITextMessages, Document {
	id: string;
}

const schemaMessages = new Schema(
	{
		id: {
			type: String,
			required: true,
		},
		channelId: {
			type: String,
			required: true,
		},
		messages: {
			type: Number,
			default: 0,
		},
	},
	{ versionKey: false }
);

export const TextMessages = model("TextMessages", schemaMessages);

// function incrementTextMessages(userId, channelId, limit: number) {}
