import { Types } from "mongoose";

export interface IUser {
	id: string;
	cash: number;
	bank: number;
	rob: number;
	bet: number;
	earnings: number;
	couples: Record<string, any>[]; // Define una interfaz más específica si es necesario
	couple: string;
	description: string;
	profile?: Record<string, any>;
	proposals: any[]; // Define una interfaz más específica si es necesario
	inventory: Types.ObjectId[];
	caps: number;
	total: number;
}
