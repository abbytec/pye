import { clearAllRedisCounter, getAllDataFromRedisCounter } from "../../utils/redisCounters.js";
import { CoreClient } from "../CoreClient.js";
import { IService } from "../IService.js";

/** Controla los contadores de uso de IA (DM y global) */
export default class AIManagerService implements IService {
	public readonly serviceName = "aiManager";
	static readonly dailyAIUsageDM = new Map<string, number>();
	public static readonly dailyAIUsage = new Map<string, number>();

	constructor(private readonly client: CoreClient) {}

	/** Recupera los contadores desde Redis (se usa al boot). */
	async start() {
		console.log("loading AI usages");
		const data = await getAllDataFromRedisCounter("dailyAIUsage").catch(() => new Map());
		data.forEach((value, key) => AIManagerService.dailyAIUsage.set(key, value));
	}

	/** Vacía los contadores (llámalo cada 24 h). */
	async dailyRepeat() {
		AIManagerService.dailyAIUsage.clear();
		AIManagerService.dailyAIUsageDM.clear();
		clearAllRedisCounter("dailyAIUsage").catch(() => null);
	}

	/** Devuelve `false` si el usuario superó 10 usos DM en el día. */
	public static checkDailyAIUsageDM(userId: string): boolean {
		const used = AIManagerService.dailyAIUsageDM.get(userId) ?? 0;
		if (used >= 10) return false;
		AIManagerService.dailyAIUsageDM.set(userId, used + 1);
		return true;
	}
}
