import { Document, Schema, model } from "mongoose";

interface IBump {
	user: string;
	fecha: Date;
}

export interface IBumpDocument extends IBump, Document {}
const bumpSchema = new Schema<IBumpDocument>(
	{
		user: {
			type: String,
			required: true,
		},
		fecha: {
			type: Date,
			required: true,
		},
	},
	{ versionKey: false }
);

export const Bumps = model("Bumps", bumpSchema);
