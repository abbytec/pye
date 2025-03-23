import { Document, Schema, Types, model } from "mongoose";

export interface IShop {
	name: string;
	itemId: string;
	price: number;
	description: string;
	message: string;
	storable: boolean | number;
	icon: string;
	role: string;
	timeout: number;
	group: string;
	background?: string;
}

export interface IShopDocument extends IShop, Document {
	_id: Types.ObjectId;
}

const schemaShop = new Schema<IShop>(
	{
		name: {
			type: String,
			required: true,
		},
		itemId: {
			type: String,
			required: true,
		},
		price: {
			type: Number,
			required: true,
		},
		description: {
			type: String,
			required: true,
		},
		message: {
			type: String,
			default: "",
		},
		storable: {
			type: Boolean || Number,
			required: true,
		},
		icon: {
			type: String,
			default: "",
		},
		role: {
			type: String,
			default: "",
		},
		timeout: {
			type: Number,
			default: 0,
		},
		group: {
			type: String,
			default: "",
		},
		background: {
			type: String,
			required: false,
		},
	},
	{ versionKey: false }
);

export const Shop = model("Shop", schemaShop);
