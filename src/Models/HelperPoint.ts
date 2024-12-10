import { Schema, Document, model } from "mongoose";
import client from "../redis.js";
import { ExtendedClient } from "../client.js";

interface IHelperPoint {
	_id: string;
	points: number;
}

export interface IHelperPointDocument extends IHelperPoint, Document {
	_id: string;
}
const helperpointSchema = new Schema<IHelperPointDocument>(
	{
		_id: {
			type: String,
			required: true,
		},
		points: {
			type: Number,
			default: 0,
		},
	},
	{ versionKey: false }
);

interface IUpdateOneContext {
	conditions: any;
	update: any;
}

helperpointSchema.pre(["save", "findOneAndUpdate"], function (this: any, next: () => void) {
	const context: IUpdateOneContext = {
		conditions: this.getFilter(),
		update: this.getUpdate(),
	};
	this._updateContext = context;
	next();
});

helperpointSchema.post(
	["save", "findOneAndUpdate"],
	async function (doc: (IHelperPointDocument | null) & { _updateContext: IUpdateOneContext }, next: () => void) {
		const context: IUpdateOneContext = this._updateContext;
		const { conditions, update } = context;
		try {
			if (update.$inc) await client.zIncrBy("top:rep", update.$inc.points, conditions._id);
		} catch (error: any) {
			ExtendedClient.logError(
				"Error actualizando 'top:rep' para el usuario " + doc._id + ": " + error.message,
				error.stack,
				process.env.CLIENT_ID
			);
		}
		next();
	}
);

export const HelperPoint = model("HelperPoint", helperpointSchema);
