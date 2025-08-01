import { Schema, Document, model } from "mongoose";

interface IHome {
	id: string;
	name: string;
	money: number;
	bump: number;
	text: number;
	rep: number;
	pet: string;
	level: number;
	house: {
		level: number;
		color: string;
	};
	active: boolean;
	monthly: number;
}

export interface IHomeDocument extends IHome, Document {
	id: string;
}

const schemaHome = new Schema<IHomeDocument>(
	{
		id: {
			type: String,
			required: true,
		},
		name: {
			type: String,
			required: false,
		},
		money: {
			type: Number,
			default: 0,
		},
		bump: {
			type: Number,
			default: 0,
		},
		text: {
			type: Number,
			default: 0,
		},
		rep: {
			type: Number,
			default: 0,
		},
		pet: {
			type: String,
			default: "none",
		},
		level: {
			type: Number,
			default: 1,
		},
		house: {
			type: Object,
			default: {
				level: 1,
				color: "Blanco",
			},
		},
		active: {
			type: Boolean,
			default: false,
		},
		monthly: {
			type: Number,
			default: 0,
		},
	},
	{ versionKey: false }
);
export const Home = model("Home", schemaHome);

export async function increaseHomeMonthlyIncome(id: string, amount: number) {
	await new Promise((resolve) => setTimeout(resolve, 3e3));
	await Home.findOneAndUpdate({ id: id }, { $inc: { monthly: amount } }, { new: true });
}

export async function levelUpHome(user: IHomeDocument, next: number, houseColor = "") {
	if (houseColor.length)
		return await Home.updateOne(
			{ id: user.id },
			{
				level: user.level + next,
				house: {
					level: user.house.level + next,
					color: houseColor,
				},
				game: 0,
				money: 0,
				bump: 0,
				text: 0,
				rep: 0,
				active: false,
			}
		);
	else
		return await Home.updateOne(
			{ id: user.id },
			{
				level: user.level + next,
				house: {
					level: user.house.level + next,
					color: user.house.color,
				},
				game: 0,
				money: 0,
				bump: 0,
				text: 0,
				rep: 0,
				active: false,
			}
		);
}
