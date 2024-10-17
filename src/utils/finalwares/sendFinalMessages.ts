import { GuildMember, TextChannel } from "discord.js";
import { Finalware } from "../../types/middleware.ts";

export const sendFinalMessages: Finalware = async (postHandleableInteraction) => {
	postHandleableInteraction.finalMessages?.forEach((message) => {
		((postHandleableInteraction.member as GuildMember).guild.channels.resolve(message.channel) as TextChannel)?.send(message.content);
	});
};
