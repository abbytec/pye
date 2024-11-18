// Models/CronMessage.ts
import { Schema, model, Document } from "mongoose";

export interface ICronMessage extends Document {
	channelId: string;
	content?: string;
	embed?: any;
	cron: string;
	repeat: boolean;
	startDate: Date;
	createdAt: Date;
	updatedAt: Date;
}

const CronMessageSchema = new Schema<ICronMessage>(
	{
		channelId: { type: String, required: true },
		content: { type: String },
		embed: { type: Object },
		cron: { type: String, required: true },
		repeat: { type: Boolean, default: false },
		startDate: { type: Date, required: true },
	},
	{ timestamps: true }
);

export const CronMessage = model<ICronMessage>("CronMessage", CronMessageSchema);
