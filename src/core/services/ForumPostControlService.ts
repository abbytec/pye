import { AnyBulkWriteOperation } from "mongoose";
import { CoreClient } from "../CoreClient.js";
import { UltimosCompartePosts, ICompartePost } from "../../Models/CompartePostModel.js";
import { ExtendedClient } from "../../client.js";
import { IService } from "../IService.js";

const sieteDiasEnMs = 7 * 24 * 60 * 60 * 1000; // 7 días

/** Administra el historial de posts comparte-post. */
export class ForumPostControlService implements IService {
	/** <userId, lista de posts últimos 7 días> */
	static readonly ultimosCompartePosts = new Map<string, ICompartePost[]>();

	constructor(private readonly client: CoreClient) {}

	public static agregarCompartePost(userId: string, channelId: string, messageId: string, hash: string) {
		if (!ForumPostControlService.ultimosCompartePosts.has(userId)) ForumPostControlService.ultimosCompartePosts.set(userId, []);
		ForumPostControlService.ultimosCompartePosts.get(userId)?.push({
			channelId,
			messageId,
			hash,
			date: new Date(),
			userId,
		});
	}

	/** Borra posts de hace más de siete días. Se llama al iniciar y cada 24 h. */
	limpiarCompartePosts() {
		const now = Date.now();
		for (const [user, posts] of ForumPostControlService.ultimosCompartePosts) {
			const recientes = posts.filter((p) => now - p.date.getTime() <= sieteDiasEnMs);
			if (recientes.length) ForumPostControlService.ultimosCompartePosts.set(user, recientes);
			else ForumPostControlService.ultimosCompartePosts.delete(user);
		}
	}

	/** Carga desde MongoDB. */
	async start() {
		this.limpiarCompartePosts();
		console.log("Cargando los ultimos CompartePosts");
		try {
			const docs = await UltimosCompartePosts.find().sort({ date: -1 }).exec();
			docs.forEach((doc) => {
				if (!ForumPostControlService.ultimosCompartePosts.has(doc.userId!))
					ForumPostControlService.ultimosCompartePosts.set(doc.userId!, []);
				ForumPostControlService.ultimosCompartePosts.get(doc.userId!)!.push({
					channelId: doc.channelId,
					messageId: doc.messageId,
					hash: doc.hash,
					date: doc.date,
					userId: doc.userId,
				});
			});
			console.log("CompartePosts cargados exitosamente desde la base de datos.");
		} catch (e: any) {
			ExtendedClient.logError("Error al cargar CompartePosts: " + e.message, e.stack, process.env.CLIENT_ID);
		}
	}

	/** Persiste el mapa actual en MongoDB. */
	async dailyRepeat() {
		this.limpiarCompartePosts();
		try {
			const bulk: AnyBulkWriteOperation<ICompartePost>[] = [
				{ deleteMany: { filter: {} } }, // vacía colección
			];

			ForumPostControlService.ultimosCompartePosts.forEach((posts, userId) =>
				posts.forEach((p) =>
					bulk.push({
						insertOne: { document: { ...p, userId } },
					})
				)
			);

			await UltimosCompartePosts.bulkWrite(bulk);
			console.log("CompartePosts guardados.");
		} catch (e: any) {
			ExtendedClient.logError("Error al guardar CompartePosts: " + e.message, e.stack, process.env.CLIENT_ID);
		}
	}
}
