import { Schema, model } from "mongoose";

interface IHelperPoint {
	_id: string;
	points: number;
}

export interface IHelperPointModel extends IHelperPoint, Document {
	_id: string;
}
const helperpointSchema = new Schema<IHelperPoint>(
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

export const HelperPoint = model("HelperPoint", helperpointSchema);
