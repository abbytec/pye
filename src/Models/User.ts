// src/models/User.ts
import { Schema, model, Document } from "mongoose";
import client from "../redis.js";
import { IUser } from "../interfaces/IUser.js";
import { increaseHomeMonthlyIncome } from "./Home.js";
import { checkQuestLevel, IQuest } from "../utils/quest.js";
import { Message, InteractionResponse, TextChannel } from "discord.js";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../client.js";
import { addRep } from "../commands/rep/add-rep.js";
import { getChannelFromEnv } from "../utils/constants.js";

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
		customBackground: {
			type: String,
			required: false,
		},
		customDecoration: {
			type: String,
			required: false,
		},
		dailyBumpTops: { type: Number, default: 0 },
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
	const pipeline = client.multi();
	pipeline.zAdd("top:all", { score: doc.total || 0, value: doc.id });
	pipeline.zAdd("top:cash", { score: doc.cash || 0, value: doc.id });
	pipeline.zAdd("top:rob", { score: doc.rob || 0, value: doc.id });
	pipeline.zAdd("top:apostador", { score: doc.earnings || 0, value: doc.id });
	pipeline.zAdd("top:caps", { score: doc.caps || 0, value: doc.id });

	await pipeline.exec().catch((error) => {
		console.error("Error actualizando Redis en 'save'/'findOneAndUpdate':", error);
	});
});

userSchema.post(["updateOne", "updateMany"], async function (result) {
	// 'this' se refiere a la consulta
	const filter = this.getFilter();
	const update = this.getUpdate?.() as Record<string, any>;

	try {
		// Recupera los documentos actualizados
		const updatedDocs = await Users.find(filter).exec();

		if (!updatedDocs || updatedDocs.length === 0) return console.warn("No se encontraron documentos actualizados para el filtro:", filter);

		// Prepara todas las operaciones ZADD para Redis
		const pipeline = client.multi();

		for (const doc of updatedDocs) {
			// Verificar que todas las propiedades necesarias existen
			if (!doc.id) return console.warn(`El documento del usuario ${doc.id} está erroneo. No se actualizará Redis.`);

			pipeline.zAdd("top:all", { score: doc.total || 0, value: doc.id });
			pipeline.zAdd("top:cash", { score: doc.cash || 0, value: doc.id });
			pipeline.zAdd("top:rob", { score: doc.rob || 0, value: doc.id });
			pipeline.zAdd("top:apostador", { score: doc.earnings || 0, value: doc.id });
			pipeline.zAdd("top:caps", { score: doc.caps || 0, value: doc.id });
			if (update?.$inc?.dailyBumpTops && doc.dailyBumpTops && (doc.dailyBumpTops + update.$inc?.dailyBumpTops) % 10 === 0)
				await addRep(doc.id, ExtendedClient.guild ?? null)
					.then(async ({ member }) => {
						const channelId = getChannelFromEnv("logPuntos");
						const channel = ExtendedClient.guild?.channels.resolve(channelId) as TextChannel | null;
						const username = member?.user.username ?? doc.id;
						await channel?.send(`\`${username}\` ha obtenido 1 punto por haber llegado 10 veces al top diario de bumps`);
						await doc.updateOne({ $inc: { bank: 1_000_000 } });
					})
					.catch((error) =>
						ExtendedClient.logError(
							`Error agregando +1 rep por llegar 10 veces al top diario de bumps ${error}` + error.message,
							error.stack,
							doc.id
						)
					);
		}

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

export async function betDone(msg: IPrefixChatInputCommand | Message | InteractionResponse, userId: string, amount: number, profit: number) {
	if (profit > 0) {
		increaseHomeMonthlyIncome(userId, profit).catch((error) => {
			console.error("Error al aumentar el ingreso mensual de la casa:", error);
			ExtendedClient.logError("Error al aumentar el ingreso mensual de la casa: " + error.message, error.stack, userId);
		});
		checkQuestLevel({ msg, money: profit, userId } as IQuest, true).catch((error) => {
			console.error("Error al actualizar la quest:", error);
			ExtendedClient.logError("Error al actualizar la quest: " + error.message, error.stack, userId);
		});
	}

	await Users.findOneAndUpdate({ id: userId }, { $inc: { bet: amount, earnings: profit, cash: profit } }, { new: true }).catch((error) => {
		console.error("Error actualizando el usuario:", error);
		ExtendedClient.logError("Error actualizando el usuario: " + error.message, error.stack, userId);
	});
}
