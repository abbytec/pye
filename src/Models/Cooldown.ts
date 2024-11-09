import { Schema, model } from "mongoose";

export interface ICooldown {
	user: string;
	command: string;
	date: Date;
}

export interface ICooldownDocument extends ICooldown, Document {}

const cooldownSchema = new Schema<ICooldownDocument>(
	{
		user: {
			type: String,
			required: true,
		},
		command: {
			type: String,
			required: true,
		},
		date: {
			type: Date,
			required: true,
		},
	},
	{ versionKey: false }
);

export const Cooldowns = model("Cooldowns", cooldownSchema);
