import { Types } from "mongoose";

export interface IUser {
	id: string;
	cash: number;
	bank: number;
	rob: number;
	bet: number;
	earnings: number;
	couples: {
		user: string;
		job: string;
	}[];
	couple: string;
	description: string;
	profile?: {
		gender: string;
		job: string;
		skin: string;
		style: string;
	};
	proposals: string[]; // Define una interfaz más específica si es necesario
	inventory: Types.ObjectId[];
	caps: number;
	total: number;
}
