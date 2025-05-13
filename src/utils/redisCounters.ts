// redisCollections.ts
import client from "../redis.js";

const PREFIX = "counters"; // raíz de todas las colecciones

type DECLARED_COUNTERS = "dailyAIUsage";

const collKey = (collection: string) => `${PREFIX}:${collection}`;

/* ────────────────────────────────────
   Incrementa un contador en una colección
   ──────────────────────────────────── */
export async function incrRedisCounter(key: DECLARED_COUNTERS, id: string, increment = 1): Promise<void> {
	await client.hIncrBy(collKey(key), id, increment).catch((e) => console.error(e));
}

/* ────────────────────────────────────
   Obtiene el valor individual (0 si no existe)
   ──────────────────────────────────── */
export async function getSingleDataFromRedisCounter(key: DECLARED_COUNTERS, id: string): Promise<number> {
	const v = await client.hGet(collKey(key), id).catch((e) => console.error(e));
	return v ? Number(v) : 0;
}

/* ────────────────────────────────────
   Devuelve todos los contadores de la colección
   ──────────────────────────────────── */
export async function getAllDataFromRedisCounter(key: DECLARED_COUNTERS): Promise<Map<string, number>> {
	const raw = await client.hGetAll(collKey(key)).catch((e) => console.error(e));
	return new Map(Object.entries(raw ?? {}).map(([k, v]) => [k, Number(v)]));
}

/* ────────────────────────────────────
   Borra TODOS los contadores de la colección
   ──────────────────────────────────── */
export async function clearAllRedisCounter(key: DECLARED_COUNTERS): Promise<void> {
	await client.del(collKey(key)).catch((e) => console.error(e)); // elimina el hash completo
}
