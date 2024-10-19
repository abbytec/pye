import { Schema, model } from "mongoose";

interface IModLogs {
	id: string;
	moderator: string;
	reason: string;
	date: Date;
	type: "Warn" | "Timeout";
	hiddenCase?: boolean;
}

export interface IModLogsModel extends IModLogs, Document {}

const modlogsSchema = new Schema<IModLogsModel>(
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
