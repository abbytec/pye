import { Schema, Document, model } from "mongoose";

export interface ITempVoiceChannel {
	channelId: string;
	ownerId: string;
	blocked: string[];
	isPublic: boolean;
	status?: string;
}

export interface ITempVoiceChannelDocument extends ITempVoiceChannel, Document {}

const tempVoiceChannelSchema = new Schema<ITempVoiceChannelDocument>(
	{
		channelId: { type: String, required: true },
		ownerId: { type: String, required: true },
		blocked: { type: [String], default: [] },
		isPublic: { type: Boolean, default: true },
		status: { type: String, default: "" },
	},
	{ versionKey: false }
);

export const TempVoiceChannel = model<ITempVoiceChannelDocument>("TempVoiceChannel", tempVoiceChannelSchema);

