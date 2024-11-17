import { Types } from "mongoose";
export interface ICouple {
	user: string;
	job: string;
}
export interface IUser {
	id: string;
	cash: number;
	bank: number;
	rob: number;
	bet: number;
	earnings: number;
	couples: ICouple[];
	couple: string;
	description: string;
	profile?: {
		gender: string;
		job: string;
		skin: string;
		style: string;
	};
	proposals: string[];
	inventory: Types.ObjectId[];
	caps: number;
	total: number;
}