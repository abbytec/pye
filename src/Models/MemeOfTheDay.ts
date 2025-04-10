import client from "../redis.js";

const KEY = "memeOfTheDay";
const analyzeMemeOfTheDay = async (url: string, username: string, reactions: number): Promise<void> => {
	const existing = await client.hGetAll(KEY);
	const currentCount = Number(existing.count) || 0;

	if (reactions > currentCount) {
		await client.hSet(KEY, {
			url,
			username,
			count: reactions.toString(),
		});
	}
};

const resetCount = async () => {
	await client.hSet(KEY, {
		count: "0",
	});
};

const getTopReaction = async () => {
	const data = await client.hGetAll(KEY);
	if (!data.url || !data.count) return null;
	return {
		url: data.url,
		username: data.username,
		count: Number(data.count),
	};
};

export const MemeOfTheDay = { analyzeMemeOfTheDay, resetCount, getTopReaction };
