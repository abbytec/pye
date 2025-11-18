import client from "../redis.js";

const key = "memeOfTheDay";
const WINDOW_MS = 24 * 60 * 60 * 1000;
export const MEME_REACTIONS = ["💤", "♻️", "<:XD:1402166423429709869>", "<:KEKW:1402166209566478439>"];
const analyzeMemeOfTheDay = async (url: string, username: string, messageUrl: string, reactions: number, postedAt: number): Promise<void> => {
	const now = Date.now();
	reactions = reactions - MEME_REACTIONS.length;
	const existing = await client.hGetAll(key);
	const lastPostedAt = Number(existing.postedAt) || 0;
	const hasValidWinner = lastPostedAt && now - lastPostedAt <= WINDOW_MS;
	const currentCount = hasValidWinner ? Number(existing.count) || 0 : 0;

	if (!hasValidWinner || reactions > currentCount) {
		await client.hSet(key, {
			url,
			username,
			messageUrl,
			count: Math.max(reactions, 0).toString(),
			postedAt: postedAt.toString(),
		});
	}
};

const resetCount = async () => {
	await client.del(key);
};

const getTopReaction = async () => {
	const data = await client.hGetAll(key);
	const postedAt = Number(data.postedAt) || 0;
	if (!data.url || !data.count || !postedAt) return null;
	if (Date.now() - postedAt > WINDOW_MS) return null;
	return {
		url: data.url,
		username: data.username,
		messageUrl: data.messageUrl,
		count: Number(data.count),
		postedAt,
	};
};

export const MemeOfTheDay = { analyzeMemeOfTheDay, resetCount, getTopReaction };
