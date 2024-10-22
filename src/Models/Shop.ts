import { HydratedDocument, Schema, model } from "mongoose";

export interface IShop {
	name: string;
	itemId: string;
	price: number;
	description: string;
	message: string;
	storable: boolean;
	icon: string;
	role: string;
	timeout: number;
	group: string;
}

export type IShopDocument = HydratedDocument<IShop>;

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
			type: Boolean,
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
	},
	{ versionKey: false }
);

export const Shop = model("Shop", schemaShop);
