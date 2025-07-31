import { Client, MessageReaction, User, TextChannel, EmbedBuilder, Events } from "discord.js";
import { StarBoard } from "../Models/StarBoard.ts";
import { StarMessage } from "../Models/StarMessage.ts";
import { Evento } from "../types/event.ts";
import { ExtendedClient } from "../client.ts";

/**
 * Maneja el evento messageReactionAdd
 * @param {Client} client - Cliente de Discord
 * @param {MessageReaction} reaction - La reacción al mensaje
 * @param {User} user - El usuario que reaccionó
 */
export default {
	name: Events.MessageReactionAdd,
	async execute(reaction: MessageReaction, user: User) {
		console.log(`Comando messageReactionAdd activado`);
		if (!reaction || !user || user.bot || reaction.emoji.name !== "⭐" || !reaction.message?.guild || reaction.message.author?.bot) return;

		const data = await StarBoard.findOne({ id: process.env.GUILD_ID });
		if (!data) return;

		try {
			const fullReaction = await fetchStructure(reaction);
			await checkReactions(fullReaction, data);
		} catch (error) {
			console.error("Error al procesar la reacción:", error);
		}
	},
} as Evento;

/**
 * Asegura que la estructura de la reacción esté completamente cargada
 * @param {MessageReaction} structure - La reacción a verificar
 */
async function fetchStructure(structure: MessageReaction): Promise<MessageReaction> {
	if (structure.partial) {
		return await structure.fetch();
	}
	return structure;
}

/**
 * Verifica y maneja las reacciones según la configuración de StarBoard
 * @param {MessageReaction} reaction - La reacción al mensaje
 * @param starboard - Configuración de la StarBoard
 */
async function checkReactions(reaction: MessageReaction, starboard: any) {
	const msg = reaction.message;
	if (!msg.guild) return;

	const postChannel = msg.guild.channels.cache.get(starboard.channel) as TextChannel;

	if (!postChannel || reaction.count < starboard.stars) return;

	const messagePosted = await StarMessage.findOne({ msgId: msg.id });

	if (messagePosted) {
		const embedMessage = await postChannel.messages.fetch(messagePosted.responseId).catch(() => null);
		if (embedMessage) {
			await embedMessage
				.edit({
					content: `**${reaction.count}** ⭐ ${msg.channel.toString()}`,
				})
				.catch(() => null);
		}
	} else {
		const msgLink = `https://discordapp.com/channels/${msg.guild.id}/${msg.channel.id}/${msg.id}`;
		const data = {
			content: msg.content?.length && msg.content.length < 3920 ? msg.content : `${msg.content?.substring(0, 3920)} **[ ... ]**`,
			avatarURL: `https://cdn.discordapp.com/avatars/${msg.author?.id}/${msg.author?.avatar}.jpg`,
			fields: {
				name: "Link del mensaje",
				value: `[Ir allá](${msgLink})`,
			},
			imageURL: "",
		};

		// Revisión de imágenes y adjuntos
		if (msg.embeds.length) {
			const imgs = msg.embeds
				.filter((embed) => embed.thumbnail || embed.image)
				.map((embed) => (embed.thumbnail ? embed.thumbnail.url : embed.image?.url));
			data.imageURL = imgs[0] ?? "";

			// Revisión de clips de Twitch
			const videoEmbed = msg.embeds.find((embed) => embed.video);
			if (videoEmbed && videoEmbed.video?.url?.includes("clips.twitch.tv")) {
				data.content += `\n⬇️ [Descarga el video](${videoEmbed.thumbnail?.url.replace("-social-preview.jpg", ".mp4")})`;
			}
		} else if (msg.attachments.size) {
			const attachment = msg.attachments.first();
			if (attachment) {
				data.imageURL = attachment.url;
				data.content += `\n📎 [${attachment.name}](${attachment.proxyURL})`;
			}
		}

		const embed = new EmbedBuilder()
			.setAuthor({ name: msg.author?.username ?? "Unknown User", iconURL: data.avatarURL })
			.setDescription(data.content)
			.setImage(data.imageURL)
			.addFields([{ name: data.fields.name, value: data.fields.value }])
			.setTimestamp();

		await postChannel
			.send({
				content: `**${reaction.count}** ⭐ ${msg.channel.toString()}`,
				embeds: [embed],
			})
			.then(async (msg) => await StarMessage.create({ msgId: msg.id, responseId: msg.id }))
			.catch(() => null);
	}
}
