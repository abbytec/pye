import {
	EmbedBuilder,
	Events,
	Guild,
	Message,
	MessageReaction,
	MessageReactionEventDetails,
	PartialMessageReaction,
	PartialUser,
	TextChannel,
	User,
} from "discord.js";
import { ExtendedClient } from "../../client.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { getYesterdayDate } from "../../utils/generic.js";
import { MEME_REACTIONS, MemeOfTheDay } from "../../Models/MemeOfTheDay.js";
import { IService } from "../IService.js";
import { logHelperPoints } from "../../utils/logHelperPoints.js";
import { addRep } from "../../commands/rep/add-rep.js";

export default class MemeProcessingService implements IService {
	private client: ExtendedClient;
	public readonly serviceName = "memeProcessing";
	private static startboardChannel = getChannelFromEnv("starboard");
	private static memesChannel = getChannelFromEnv("memes");

	constructor(client: ExtendedClient) {
		this.client = client;
	}

	public start() {
		this.client.on(Events.MessageCreate, this.onMessageCreate.bind(this));
		this.client.on(Events.MessageReactionAdd, this.onMessageReactionAdd.bind(this));
		console.log("MemeProcessingService started");
	}

	public async dailyRepeat(): Promise<void> {
		try {
			const top = await MemeOfTheDay.getTopReaction();
			if (!top) return;
			const embed = new EmbedBuilder()
				.setAuthor({
					name: "Meme del día",
					iconURL:
						"https://cdn.discordapp.com/attachments/1115058778736431104/1282790824744321167/vecteezy_heart_1187438.png?ex=66e0a38d&is=66df520d",
				})
				.setDescription(`Subido por **${top.username}** [(ir al meme)](${top.messageUrl})`)
				.setImage(top.url)
				.setFooter({ text: `💬 ${top.count} reacciones` })
				.setColor(COLORS.pyeLightBlue);

			const channel = (this.client.channels.cache.get(MemeProcessingService.startboardChannel) ??
				(await this.client.channels.fetch(MemeProcessingService.startboardChannel))) as TextChannel | undefined;
			channel
				?.send({ embeds: [embed] })
				.then(async () => {
					const match = /\/(\d+)\/(\d+)\/(\d+)$/.exec(top.messageUrl);
					if (match) {
						const [, guildId, channelId, messageId] = match;
						const guild = await this.client.guilds.fetch(guildId).catch(() => null);
						const ch = guild?.channels.resolve(channelId) as TextChannel | undefined;
						const msg = await ch?.messages.fetch(messageId).catch(() => null);
						if (msg)
							await addRep(msg.author, msg.guild, 0.1).then(({ member }) =>
								logHelperPoints(msg.guild, `\`${member.user.username}\` ha obtenido 0.1 rep por meme del día`)
							);
					}
				})
				.then(() => MemeOfTheDay.resetCount());
		} catch (error) {
			console.error(error);
		}
	}

	private async onMessageCreate(message: Message) {
		if (message.channel.id === MemeProcessingService.memesChannel) {
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
		if (reaction.message.channelId === MemeProcessingService.memesChannel) {
			if (reaction.partial) await reaction.fetch();
			const message = reaction.message;
			// Obtener imagen adjunta (primer adjunto que sea imagen)
			const imageAttachment = message.attachments.find((att) => att.contentType?.startsWith("image/"))?.url;

			if (imageAttachment && message.createdAt >= getYesterdayDate())
				await MemeOfTheDay.analyzeMemeOfTheDay(
					imageAttachment,
					message.author?.tag ?? "Autor desconocido",
					message.url,
					message.reactions.cache.reduce((acc, r) => acc + (r.count || 0), 0),
					message.createdTimestamp
				);
		}
	}
}
