import { Job } from "agenda";
import { EmbedBuilder, TextChannel } from "discord.js";
import { IService } from "../IService.js";
import { ExtendedClient } from "../../client.js";
import { AgendaManager } from "../AgendaManager.js";

export default class ReminderService implements IService {
	public readonly serviceName = "reminder";

	constructor(private readonly client: ExtendedClient) {}

	async start() {
		const agenda = AgendaManager.getInstance();

		// Define el trabajo para enviar recordatorios por DM
		agenda.define("send reminder dm", async (job: Job) => {
			const { userIds, message, embed } = job.attrs.data;
			console.log(`Enviando recordatorios por DM a los usuarios: ${userIds.join(", ")}`);

			const guild =
				this.client.guilds.cache.get(process.env.GUILD_ID ?? "") ?? (await this.client.guilds.fetch(process.env.GUILD_ID ?? ""));

			if (!guild) return;

			for (const userId of userIds) {
				const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));

				if (member) {
					await member
						.send({ content: `⏰ **<@${userId}>  Recordatorio:** ${message}`, embeds: embed ? [embed] : [] })
						.then(() => console.log(`Recordatorio por DM enviado a ${userId}`))
						.catch((error) => console.error(`Error al enviar recordatorio a ${userId} via DM:`, error));
				}
			}
			await job.remove();
		});

		// Define el trabajo para enviar recordatorios en un canal
		agenda.define("send reminder", async (job: Job) => {
			const { message, channelId, embed } = job.attrs.data;
			const channel = (this.client.channels.cache.get(channelId) ?? this.client.channels.resolve(channelId)) as TextChannel;

			if (channel) {
				await channel
					.send({ content: message, embeds: embed ? [embed] : [] })
					.then(() => console.log(`Recordatorio de canal enviado.`))
					.then(async () => await job.remove())
					.catch((error) => console.error(`Error al enviar recordatorio de canal:`, error));
			}
		});

		console.log("✅ ReminderService iniciado correctamente");
	}

	/**
	 * Programa un recordatorio en un canal
	 */
	async scheduleReminder(data: { message?: string; channelId: string; reminderTime: Date; embed?: EmbedBuilder }): Promise<void> {
		const agenda = AgendaManager.getInstance();
		await agenda.schedule(data.reminderTime, "send reminder", {
			message: data.message,
			channelId: data.channelId,
			embed: data.embed,
		});
	}

	/**
	 * Programa un recordatorio por DM
	 */
	async scheduleReminderDM(data: { userIds: string[]; message: string; reminderTime: Date; embed?: EmbedBuilder }): Promise<Job | undefined> {
		const agenda = AgendaManager.getInstance();
		return await agenda.schedule(data.reminderTime, "send reminder dm", {
			userIds: data.userIds,
			message: data.message,
			embed: data.embed,
		});
	}
}
