import { GuildMember, TextChannel } from "discord.js";
import { Finalware } from "../../types/middleware.ts";

export const sendFinalMessages: Finalware = async (postHandleableInteraction, result) => {
	result.finalMessages?.forEach((message) => {
		((postHandleableInteraction.member as GuildMember).guild.channels.resolve(message.channel) as TextChannel)?.send(message.content);
	});
};

export const replyOkToMessage: Finalware = async (postHandleableInteraction, result) => {
	if (postHandleableInteraction.deferred) {
		await postHandleableInteraction.deleteReply().catch((e) => console.error(e));
	}
	if (result.reactOkMessage === null) return;
	await (postHandleableInteraction.guild?.channels.resolve(postHandleableInteraction?.channelId) as TextChannel)?.send({
		content: "✅ " + (result.reactOkMessage ?? "Listo!"),
	});
};
export const replyWarningToMessage: Finalware = async (postHandleableInteraction, result) => {
	if (postHandleableInteraction.deferred) {
		await postHandleableInteraction.deleteReply().catch((e) => console.error(e));
	}
	if (result.reactWarningMessage === null) return;
	await (postHandleableInteraction.guild?.channels.resolve(postHandleableInteraction?.channelId) as TextChannel)?.send({
		content: "⚠️ " + (result.reactWarningMessage ?? "Listo!"),
	});
};
