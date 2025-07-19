import { Message, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.js";
import { getChannelFromEnv } from "../utils/constants.js";
import { hashMessage } from "./messageHashing.js";
import natural from "natural";
import ForumPostControlService from "../core/services/ForumPostControlService.js";
import { convertMsToUnixTimestamp } from "../utils/generic.js";

export async function checkCooldownComparte(msg: Message<boolean>, client: ExtendedClient): Promise<number | undefined> {
	let lastPosts = ForumPostControlService.ultimosCompartePosts
		.get(msg.author.id)
		?.filter((post) => post.date.getTime() + 1000 * 60 * 60 * 24 * 7 >= Date.now());

	if (!lastPosts) return;
	let cooldownPost: number | undefined = undefined;
	for (const post of lastPosts) {
		const channel = (client.channels.cache.get(post.channelId) ?? client.channels.resolve(post.channelId)) as TextChannel;
		await channel.messages
			.fetch(post.messageId)
			.then(async (message) => {
				let distance = natural.JaroWinklerDistance(message.content, msg.content, { ignoreCase: true });

				const oldMessageLink = `https://discord.com/channels/${process.env.GUILD_ID}/${post.channelId}/${post.messageId}`;
				if (distance > 0.9) {
					const logMessagesChannel = (client.channels.cache.get(getChannelFromEnv("logMessages")) ??
						client.channels.resolve(getChannelFromEnv("logMessages"))) as TextChannel;
					if (!logMessagesChannel)
						ExtendedClient.logError(
							"checkCooldownComparte: No se encontró el canal de log de Mensajes.",
							undefined,
							process.env.CLIENT_ID
						);
					cooldownPost ??= post.date.getTime() + 1000 * 60 * 60 * 24 * 7 - Date.now();
					const msgExtension = msg.channel.id == post.messageId ? "" : `, en el canal <#${msg.channel.id}>`;
					await logMessagesChannel
						.send({
							content: `Se eliminó un post duplicado, copia de ${oldMessageLink}${msgExtension}`,
						})
						.catch(() => console.error("No se pudo enviar el log de mensajes"));
				} else if (distance > 0.75) {
					const moderatorChannel = (client.channels.cache.get(getChannelFromEnv("notificaciones")) ??
						client.channels.resolve(getChannelFromEnv("notificaciones"))) as TextChannel;
					if (!moderatorChannel)
						ExtendedClient.logError(
							"checkCooldownComparte: No se encontró el canal de notificaciones.",
							undefined,
							process.env.CLIENT_ID
						);
					const newMessageLink = `https://discord.com/channels/${process.env.GUILD_ID}/${msg.channel.id}/${msg.id}`;
					await moderatorChannel.send({
						content: `**Advertencia:** Posible post duplicado: #1 {${oldMessageLink}} #2 {${newMessageLink}}`,
					});
				}
			})
			.catch(() => {
				if (cooldownPost === undefined && hashMessage(msg.content) === post.hash)
					cooldownPost = post.date.getTime() + 1000 * 60 * 60 * 24 * 7 - Date.now();
			});
	}
	if (cooldownPost === undefined) {
		ForumPostControlService.agregarCompartePost(msg.author.id, msg.channel.id, msg.id, hashMessage(msg.content));
		return;
	}
	let warn = await (msg.channel as TextChannel).send({
		content: `🚫 <@${
			msg.author.id
		}>Por favor, espera 1 semana entre publicaciónes similares en los canales de compartir. (Tiempo restante: <t:${convertMsToUnixTimestamp(
			cooldownPost
		)}:R>)`,
	});
	await msg.delete().catch(() => null);

	setTimeout(async () => await warn.delete().catch(() => null), 10000);
	return cooldownPost;
}
