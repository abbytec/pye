import client from "../redis.js";

const key = "memeOfTheDay";
export const MEME_REACTIONS = ["💤", "♻️", "<:XD:1402166423429709869>", "<:KEKW:1402166209566478439>"];
const analyzeMemeOfTheDay = async (url: string, username: string, messageUrl: string, reactions: number): Promise<void> => {
	const existing = await client.hGetAll(key);
	const currentCount = Number(existing.count) || 0;

	if (reactions > currentCount) {
		await client.hSet(key, {
			url,
			username,
			messageUrl: messageUrl,
			count: reactions.toString(),
		});
	}
};

const resetCount = async () => {
	await client.hSet(key, {
		count: "0",
	});
};

const getTopReaction = async () => {
	const data = await client.hGetAll(key);
	if (!data.url || !data.count) return null;
	return {
		url: data.url,
		username: data.username,
		messageUrl: data.messageUrl,
		count: Number(data.count),
	};
};

export const MemeOfTheDay = { analyzeMemeOfTheDay, resetCount, getTopReaction };
