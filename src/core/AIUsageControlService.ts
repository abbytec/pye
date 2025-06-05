import { clearAllRedisCounter, getAllDataFromRedisCounter } from "../utils/redisCounters.js";
import { CoreClient } from "./CoreClient.js";

/** Controla los contadores de uso de IA (DM y global) */
export class AIUsageControlService {
	static readonly dailyAIUsageDM = new Map<string, number>();
	public static readonly dailyAIUsage = new Map<string, number>();

	constructor(private readonly client: CoreClient) {}

	/** Recupera los contadores desde Redis (se usa al boot). */
	async loadDailyUsage() {
		console.log("loading AI usages");
		const data = await getAllDataFromRedisCounter("dailyAIUsage").catch(() => new Map());
		data.forEach((value, key) => AIUsageControlService.dailyAIUsage.set(key, value));
	}

	/** Vacía los contadores (llámalo cada 24 h). */
	resetDaily() {
		AIUsageControlService.dailyAIUsage.clear();
		AIUsageControlService.dailyAIUsageDM.clear();
		clearAllRedisCounter("dailyAIUsage").catch(() => null);
	}

	/** Devuelve `false` si el usuario superó 10 usos DM en el día. */
	public static checkDailyAIUsageDM(userId: string): boolean {
		const used = AIUsageControlService.dailyAIUsageDM.get(userId) ?? 0;
		if (used >= 10) return false;
		AIUsageControlService.dailyAIUsageDM.set(userId, used + 1);
		return true;
	}
}
