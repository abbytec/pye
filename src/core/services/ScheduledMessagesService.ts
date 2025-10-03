import { Job } from "agenda";
import { EmbedBuilder, TextChannel } from "discord.js";
import { IService } from "../IService.js";
import { ExtendedClient } from "../../client.js";
import { CronMessage } from "../../Models/CronMessage.js";
import { createPyechanEmbed, MASCOT_AUTHOR, MASCOT_THUMBNAIL } from "../../utils/messages/createPyechanEmbed.js";
import { AgendaManager } from "../AgendaManager.js";

export default class ScheduledMessagesService implements IService {
	public readonly serviceName = "scheduledMessages";

	constructor(private readonly client: ExtendedClient) {}

	async start() {
		const agenda = AgendaManager.getInstance();

		// Define el trabajo para enviar mensajes cron
		agenda.define("send cron message", async (job: Job) => {
			const { channelId, content, embed, cronMessageId } = job.attrs.data;
			const channel = (this.client.channels.cache.get(channelId) ?? 
				this.client.channels.resolve(channelId)) as TextChannel;
			
			if (channel) {
				let embedObject: EmbedBuilder;
				if (embed) {
					embedObject = new EmbedBuilder(embed);
					if (!embedObject.data.author) embedObject.setAuthor(MASCOT_AUTHOR);
					if (!embedObject.data.thumbnail) embedObject.setThumbnail(MASCOT_THUMBNAIL);
				} else {
					embedObject = createPyechanEmbed(content ?? "");
				}

				await channel
					.send({
						content: embed ? content ?? undefined : undefined,
						embeds: [embedObject],
					})
					.then(() => console.log(`Mensaje cron enviado al canal ${channelId}`))
					.then(async () => 
						job.attrs.nextRunAt ? await CronMessage.deleteOne({ _id: cronMessageId }).exec() : null
					)
					.catch((error) => console.error(`Error al enviar mensaje cron al canal ${channelId}:`, error));
			}
		});

		console.log("✅ ScheduledMessagesService iniciado correctamente");
	}

	/**
	 * Crea un mensaje programado recurrente
	 */
	async createRecurringMessage(data: {
		channelId: string;
		content: string | null;
		embed: any | null;
		cronString: string;
		startDate: Date;
		cronMessageId: string;
	}): Promise<void> {
		const agenda = AgendaManager.getInstance();
		await agenda.every(
			data.cronString,
			"send cron message",
			{
				channelId: data.channelId,
				content: data.content,
				embed: data.embed,
				cronMessageId: data.cronMessageId,
			},
			{ startDate: data.startDate }
		);
	}

	/**
	 * Crea un mensaje programado de ejecución única
	 */
	async createOneTimeMessage(data: {
		channelId: string;
		content: string | null;
		embed: any | null;
		startDate: Date;
		cronMessageId: string;
	}): Promise<void> {
		const agenda = AgendaManager.getInstance();
		const job = agenda.create("send cron message", {
			channelId: data.channelId,
			content: data.content,
			embed: data.embed,
			cronMessageId: data.cronMessageId,
		});
		job.unique({ cronMessageId: data.cronMessageId });
		job.schedule(data.startDate);
		await job.save();
	}

	/**
	 * Elimina un mensaje programado
	 */
	async removeScheduledMessage(cronMessageId: string): Promise<void> {
		const agenda = AgendaManager.getInstance();
		await agenda.cancel({ "data.cronMessageId": cronMessageId });
	}
}

