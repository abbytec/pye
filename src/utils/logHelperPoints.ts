import { Guild, TextChannel } from "discord.js";
import { getChannelFromEnv } from "./constants.js";

export async function logHelperPoints(guild: Guild | null, content: string) {
	if (!guild) return;
	const channel = guild.channels.resolve(getChannelFromEnv("logPuntos")) as TextChannel | null;
	await channel?.send(content);
}

