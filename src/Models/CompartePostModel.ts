// ./Models/CompartePostModel.ts

import mongoose, { Schema, Document } from "mongoose";

export interface ICompartePost {
	userId?: string;
	date: Date;
	messageId: string;
	hash: string;
	channelId: string;
}

export interface ICompartePostModel extends ICompartePost, Document {
	userId: string;
}

const CompartePostSchema: Schema = new Schema({
	userId: { type: String, required: true },
	channelId: { type: String, required: true },
	messageId: { type: String, required: true },
	hash: { type: String, required: true },
	date: { type: Date, required: true },
});

export const UltimosCompartePosts = mongoose.model<ICompartePost>("UltimosCompartePosts", CompartePostSchema);
