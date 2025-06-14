import { Document, Schema, model } from "mongoose";
import client from "../redis.js";
import { ExtendedClient } from "../client.js";

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
bumpSchema.post("save", function (doc: IBumpDocument) {
	client
		.zIncrBy("top:bump", 1, doc.user) // +1 bump
		.catch((error: any) =>
			ExtendedClient.logError(
				`Error actualizando 'top:bump' para el usuario ${doc.user}: ${error.message}`,
				error.stack,
				process.env.CLIENT_ID
			)
		);
});
export const Bumps = model("Bumps", bumpSchema);
