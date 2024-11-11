import { Schema, model } from "mongoose";

interface Role {
	id: string;
	rolId: string;
	guildId: string;
	count: number;
}

interface RoleDocument extends Role, Document {}

const schemaUserRole = new Schema<RoleDocument>(
	{
		id: {
			type: String,
			required: true,
		},
		rolId: {
			type: String,
			required: true,
		},
		guildId: {
			type: String,
			required: true,
		},
		count: {
			type: Number,
			required: true,
		},
	},
	{ versionKey: false }
);

export const UserRole = model("UserRole", schemaUserRole);
