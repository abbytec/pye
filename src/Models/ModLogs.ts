import { Schema, Document, model } from "mongoose";

interface IModLogs {
	id: string;
	moderator: string;
	reason: string;
	date: Date;
	type: "Warn" | "Timeout" | "Ban" | "Voice-mute" | "Restrict";
	hiddenCase?: boolean;
	reasonUnpenalized?: string;
	duration?: number;
}

export interface IModLogsDocument extends IModLogs, Document {
	id: string;
}

const modlogsSchema = new Schema<IModLogsDocument>(
	{
		id: {
			type: String,
			required: true,
		},
		moderator: {
			type: String,
			required: true,
		},
		reason: {
			type: String,
			required: true,
		},
		date: {
			type: Date,
			required: true,
		},
		type: {
			type: String,
			required: true,
			default: "Timeout",
		},
		hiddenCase: {
			type: Boolean,
			default: false,
		},
		reasonUnpenalized: {
			type: String,
		},
		duration: {
			type: Number,
		},
	},
	{ versionKey: false }
);

export const ModLogs = model("ModLogs", modlogsSchema);
