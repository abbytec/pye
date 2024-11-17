// src/models/User.ts
import { Schema, model, Document } from "mongoose";
import client from "../redis.ts";
import { IUser } from "../interfaces/IUser.ts";

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
	await client.sendCommand(["ZADD", "top:all", doc.total.toString() ?? 0, doc.id]);
	await client.sendCommand(["ZADD", "top:cash", doc.cash.toString() ?? 0, doc.id]);
	await client.sendCommand(["ZADD", "top:rob", doc.rob.toString() ?? 0, doc.id]);
	await client.sendCommand(["ZADD", "top:apostador", (doc.earnings - doc.bet).toString() ?? 0, doc.id]);
	await client.sendCommand(["ZADD", "top:caps", doc.caps.toString() ?? 0, doc.id]);
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
 * Middleware pre-updateOne para capturar las condiciones y las actualizaciones.
 */
interface IUpdateOneContext {
	conditions: any;
	update: any;
}

userSchema.pre("updateOne", function (this: any, next: () => void) {
	const context: IUpdateOneContext = {
		conditions: this.getFilter(),
		update: this.getUpdate(),
	};
	// Guardar el contexto en el objeto de consulta
	this._updateContext = context;
	next();
});

/**
 * Middleware post-updateOne para actualizar los rankings en Redis.
 */
userSchema.post("updateOne", async function (result: any, next: () => void) {
	const context: IUpdateOneContext = (this as any)._updateContext;
	const { conditions, update } = context;

	if (update.$inc) {
		if (update.$inc.total) {
			await client.sendCommand(["ZINCRBY", "top:all", update.$inc.total.toString(), conditions.id]);
		}
		if (update.$inc.cash) {
			await client.sendCommand(["ZINCRBY", "top:cash", update.$inc.cash.toString(), conditions.id]);
		}
		if (update.$inc.rob) {
			await client.sendCommand(["ZINCRBY", "top:rob", update.$inc.rob.toString(), conditions.id]);
		}
	}
	next();
});

/**
 * Middleware pre-updateMany para capturar las condiciones y las actualizaciones.
 */
interface IUpdateManyContext {
	conditions: any;
	update: any;
}

userSchema.pre("updateMany", function (this: any, next: () => void) {
	const context: IUpdateManyContext = {
		conditions: this.getFilter(),
		update: this.getUpdate(),
	};
	// Guardar el contexto en el objeto de consulta
	this._updateContext = context;
	next();
});

/**
 * Middleware post-updateMany para actualizar los rankings en Redis.
 */
userSchema.post("updateMany", async function (result: any, next: () => void) {
	const context: IUpdateManyContext = (this as any)._updateContext;
	const { conditions, update } = context;

	if (update.$inc && conditions?.id?.$in) {
		const multi = client.multi();
		for (const userId of conditions.id.$in) {
			if (update.$inc.total) {
				multi.zIncrBy("top:all", update.$inc.total.toString(), userId);
			}
			if (update.$inc.cash) {
				multi.zIncrBy("top:cash", update.$inc.cash.toString(), userId);
			}
		}
	}
	next();
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
