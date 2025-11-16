import {
	Events,
	Message,
	MessageReaction,
	MessageReactionEventDetails,
	PartialMessageReaction,
	PartialUser,
	TextChannel,
	User,
} from "discord.js";
import { ExtendedClient } from "../../client.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { getYesterdayDate } from "../../utils/generic.js";
import { MEME_REACTIONS, MemeOfTheDay } from "../../Models/MemeOfTheDay.js";
import { IService } from "../IService.js";

export default class MemeProcessingService implements IService {
	private client: ExtendedClient;
	public readonly serviceName = "memeProcessing";

	constructor(client: ExtendedClient) {
		this.client = client;
	}

	public start() {
		this.client.on(Events.MessageCreate, this.onMessageCreate.bind(this));
		this.client.on(Events.MessageReactionAdd, this.onMessageReactionAdd.bind(this));
		console.log("MemeProcessingService started");
	}

	private async onMessageCreate(message: Message) {
		if (message.channel.id === getChannelFromEnv("memes")) {
			if (message.attachments.size === 0) {
				await message.delete().catch(() => null);
				await (message.channel as TextChannel)
					.send({
						content: `🚫 <@${message.author.id}>, este canal es únicamente para enviar memes.`,
					})
					.then((aviso) => setTimeout(() => aviso.delete().catch(() => null), 10000));
			} else {
				for (const reaction of MEME_REACTIONS) {
					await message.react(reaction).catch((e) => console.error("Error al reaccionar", e));
				}
			}
		}
	}

	private async onMessageReactionAdd(
		reaction: MessageReaction | PartialMessageReaction,
		user: User | PartialUser,
		details: MessageReactionEventDetails
	) {
		if (reaction.message.channelId === getChannelFromEnv("memes")) {
			if (reaction.partial) await reaction.fetch();
			const message = reaction.message;
			// Obtener imagen adjunta (primer adjunto que sea imagen)
			const imageAttachment = message.attachments.find((att) => att.contentType?.startsWith("image/"))?.url;

			if (imageAttachment && message.createdAt >= getYesterdayDate())
				await MemeOfTheDay.analyzeMemeOfTheDay(
					imageAttachment,
					message.author?.tag ?? "Autor desconocido",
					message.url,
					message.reactions.cache.reduce((acc, r) => acc + (r.count || 0), 0)
				);
		}
	}
}
