import { MessageReaction, User, TextChannel, EmbedBuilder, Events } from "discord.js";
import { IStarBoardDocument, StarBoard } from "../Models/StarBoard.js";
import { StarMessage } from "../Models/StarMessage.js";
import { Evento } from "../types/event.js";
import { getChannelFromEnv, getRoleFromEnv } from "../utils/constants.js";
import { addRep } from "../commands/rep/add-rep.js";
import { UserRole } from "../Models/Role.js";
import { MemeOfTheDay } from "../Models/MemeOfTheDay.js";
import { getTodayUTC } from "../utils/generic.js";
import { TrendingService } from "../core/TrendingService.js";

/**
 * Maneja el evento messageReactionAdd
 * @param {MessageReaction} reaction - La reacción al mensaje
 * @param {User} user - El usuario que reaccionó
 */
export default {
	name: Events.MessageReactionAdd,
	async execute(reaction: MessageReaction, user: User) {
		if (!reaction || !user || user.bot || !reaction.message?.guild) return;
		let fullReaction = await fetchStructure(reaction);
		const textChannel = reaction.message.channel as TextChannel;
		let category = textChannel.parentId;
		if (reaction.emoji.name === "⭐" && category !== getChannelFromEnv("categoryStaff") && !textChannel.nsfw) {
			const data = await StarBoard.findOne({ id: process.env.GUILD_ID });
			if (!data) return;
			await checkReactions(fullReaction, data).catch((error: any) => console.error("Error al procesar la reacción:", error));
		} else if (
			reaction.emoji.name === "pepedown" &&
			(fullReaction.count ?? 0) > 4 &&
			reaction.message.member &&
			!reaction.message.member.roles.cache.get(getRoleFromEnv("iqNegativo"))
		) {
			await reaction.message.member.roles.add(getRoleFromEnv("iqNegativo")).catch(() => null);
			await UserRole.findOneAndUpdate(
				{
					id: reaction.message.member.id,
					rolId: getRoleFromEnv("iqNegativo"),
					guildId: process.env.GUILD_ID ?? "",
				},
				{
					$setOnInsert: {
						count: 1000 * 60 * 60 * 3 + Date.now(),
					},
				},
				{
					upsert: true,
					new: true,
				}
			);
		}
		if (reaction.message.channelId === getChannelFromEnv("memes")) {
			if (reaction.partial) await reaction.fetch();
			const message = reaction.message;
			// Obtener imagen adjunta (primer adjunto que sea imagen)
			const imageAttachment = message.attachments.find((att) => att.contentType?.startsWith("image/"))?.url;

			if (imageAttachment && message.createdAt >= getTodayUTC())
				await MemeOfTheDay.analyzeMemeOfTheDay(
					imageAttachment,
					message.author?.tag ?? "Autor desconocido",
					message.url,
					message.reactions.cache.reduce((acc, r) => acc + (r.count || 0), 0)
				);
		}
		if (fullReaction.emoji.id) TrendingService.trending.add("emoji", (fullReaction.emoji.name ?? "") + ":" + fullReaction.emoji.id);
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
async function checkReactions(reaction: MessageReaction, starboard: IStarBoardDocument) {
	const msg = reaction.message;
	if (!msg.guild) return;

	const postChannel = (msg.guild.channels.cache.get(starboard.channel) ?? msg.guild.channels.resolve(starboard.channel)) as TextChannel;

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
			imageURL: null as string | null,
		};

		// Revisión de imágenes y adjuntos
		if (msg.embeds.length) {
			const imgs = msg.embeds
				.filter((embed) => embed.thumbnail || embed.image)
				.map((embed) => (embed.thumbnail ? embed.thumbnail.url : embed.image?.url));
			data.imageURL = imgs[0] ?? "";

			// Revisión de clips de Twitch
			const videoEmbed = msg.embeds.find((embed) => embed.video);
			if (videoEmbed?.video?.url?.includes("clips.twitch.tv")) {
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
			.addFields([{ name: data.fields.name, value: data.fields.value }])
			.setTimestamp();
		if (data.imageURL) embed.setImage(data.imageURL);

		await postChannel
			.send({
				content: `**${reaction.count}** ⭐ ${msg.channel.toString()}`,
				embeds: [embed],
			})
			.then(async (starboardMessage) => await StarMessage.create({ msgId: msg.id, responseId: starboardMessage.id }))
			.then(
				async () =>
					await addRep(reaction.message.author, reaction.message.guild).then(({ member }) =>
						(reaction.message.guild?.channels.resolve(getChannelFromEnv("logPuntos")) as TextChannel | null)?.send(
							`${member.user.username} ha obtenido 1 punto porque su mensaje ${msg.url} llegó a la starboard`
						)
					)
			)
			.catch(() => null);
	}
}
