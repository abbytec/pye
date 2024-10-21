import { Schema, model } from "mongoose";

interface IModLogs {
	id: string;
	moderator: string;
	reason: string;
	date: Date;
	type: "Warn" | "Timeout" | "Ban";
	hiddenCase?: boolean;
}

export interface IModLogsDocument extends IModLogs, Document {
	_id: string;
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
	},
	{ versionKey: false }
);

export const ModLogs = model("ModLogs", modlogsSchema);
