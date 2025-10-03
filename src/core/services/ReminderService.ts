import { Job } from "agenda";
import { TextChannel } from "discord.js";
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
			const { userId, message } = job.attrs.data;
			console.log(`Enviando recordatorio por DM a ${userId}`);
			
			const guild = this.client.guilds.cache.get(process.env.GUILD_ID ?? "") ?? 
				(await this.client.guilds.fetch(process.env.GUILD_ID ?? ""));
			
			if (!guild) return;
			
			const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));
			
			if (member) {
				await member
					.send(`⏰ **<@${userId}>  Recordatorio:** ${message}`)
					.then(() => console.log(`Recordatorio por DM enviado a ${userId}`))
					.then(async () => await job.remove())
					.catch((error) => console.error(`Error al enviar recordatorio a ${userId} via DM:`, error));
			}
		});

		// Define el trabajo para enviar recordatorios en un canal
		agenda.define("send reminder", async (job: Job) => {
			const { username, userId, message, channelId } = job.attrs.data;
			const channel = (this.client.channels.cache.get(channelId) ?? 
				this.client.channels.resolve(channelId)) as TextChannel;
			
			if (channel) {
				await channel
					.send(`⏰ **<@${userId}>  Recordatorio:** ${message}`)
					.then(() => console.log(`Recordatorio enviado a ${username}`))
					.then(async () => await job.remove())
					.catch((error) => console.error(`Error al enviar recordatorio a ${username}:`, error));
			}
		});

		console.log("✅ ReminderService iniciado correctamente");
	}

	/**
	 * Programa un recordatorio en un canal
	 */
	async scheduleReminder(data: {
		userId: string;
		username: string;
		message: string;
		channelId: string;
		reminderTime: Date;
	}): Promise<void> {
		const agenda = AgendaManager.getInstance();
		await agenda.schedule(data.reminderTime, "send reminder", {
			username: data.username,
			userId: data.userId,
			message: data.message,
			channelId: data.channelId,
		});
	}

	/**
	 * Programa un recordatorio por DM
	 */
	async scheduleReminderDM(data: {
		userId: string;
		message: string;
		reminderTime: Date;
	}): Promise<void> {
		const agenda = AgendaManager.getInstance();
		await agenda.schedule(data.reminderTime, "send reminder dm", {
			userId: data.userId,
			message: data.message,
		});
	}
}

