// src/models/User.ts
import { Schema, model, Document } from "mongoose";
import client from "../redis.js";
import { IUser } from "../interfaces/IUser.js";

export interface IUserModel extends IUser, Document {
	id: string;
}

const userSchema = new Schema<IUserModel>(
	{
		id: {
			type: String,
			required: true,
		},
		cash: {
			type: Number,
			default: 0,
		},
		bank: {
			type: Number,
			default: 0,
		},
		rob: {
			type: Number,
			default: 0,
		},
		bet: {
			type: Number,
			default: 0,
		},
		earnings: {
			type: Number,
			default: 0,
		},
		couples: {
			type: [Object],
			default: [],
		},
		couple: {
			type: String,
			default: "none",
		},
		description: {
			type: String,
			default: "Mirame soy una linda mariposa. 🦋",
		},
		profile: {
			type: Object,
			required: false,
		},
		proposals: {
			type: [String],
			default: [],
		},
		inventory: {
			type: [Schema.Types.ObjectId],
			default: [],
			ref: "Shop",
		},
		caps: {
			type: Number,
			default: 0,
		},
	},
	{ versionKey: false }
);

/**
 * Virtual para calcular el total como la suma de cash y bank.
 */
userSchema.virtual("total").get(function (this: IUserModel) {
	return this.cash + this.bank;
});

/**
 * Middleware post-save para actualizar los rankings en Redis.
 */
userSchema.post(["save", "findOneAndUpdate"], async function (doc: IUserModel | null) {
	if (!doc) return;
	await client.sendCommand(["ZADD", "top:all", (doc.total ?? 0).toString(), doc.id]);
	await client.sendCommand(["ZADD", "top:cash", (doc.cash ?? 0).toString(), doc.id]);
	await client.sendCommand(["ZADD", "top:rob", (doc.rob ?? 0).toString(), doc.id]);
	await client.sendCommand(["ZADD", "top:apostador", ((doc.earnings ?? 0) - (doc.bet ?? 0)).toString(), doc.id]);
	await client.sendCommand(["ZADD", "top:caps", (doc.caps ?? 0).toString(), doc.id]);
});

userSchema.post(["updateOne", "updateMany"], async function (result) {
	// 'this' se refiere a la consulta
	const filter = this.getFilter();

	try {
		// Recupera los documentos actualizados
		const updatedDocs = await Users.find(filter).exec();

		if (!updatedDocs || updatedDocs.length === 0) return console.warn("No se encontraron documentos actualizados para el filtro:", filter);

		// Prepara todas las operaciones ZADD para Redis
		const pipeline = client.multi();

		updatedDocs.forEach((doc) => {
			// Verificar que todas las propiedades necesarias existen
			if (!doc.id) return console.warn(`El documento del usuario ${doc.id} está erroneo. No se actualizará Redis.`);

			pipeline.zAdd("top:all", { score: doc.total || 0, value: doc.id });
			pipeline.zAdd("top:cash", { score: doc.cash || 0, value: doc.id });
			pipeline.zAdd("top:rob", { score: doc.rob || 0, value: doc.id });
			pipeline.zAdd("top:apostador", { score: doc.earnings - doc.bet || 0, value: doc.id });
			pipeline.zAdd("top:caps", { score: doc.caps || 0, value: doc.id });
		});

		const results = await pipeline.exec();
		results.forEach((result, index) => {
			if (Array.isArray(result)) {
				const [error] = result;
				if (error) {
					console.error(`Error en el comando ${index + 1}:`, error);
				}
			}
		});
	} catch (error) {
		console.error(`Error actualizando Redis en 'updateOne'/'updateMany' con filtro ${JSON.stringify(filter)}:`, error);
	}
});

/**
 * Exporta el modelo de usuario.
 */
export const Users = model<IUserModel>("Users", userSchema);

export async function getOrCreateUser(id: string): Promise<IUserModel> {
	const user = await Users.findOne({ id });
	if (user) return user;
	return await Users.create({ id });
}
