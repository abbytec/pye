import { Events, ActivityType, EmbedBuilder, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { CommandLimits, ICommandLimits } from "../Models/Command.ts";
import { Money, IMoney } from "../Models/Money.ts";
import { Users } from "../Models/User.ts";
import { Agenda, Job } from "agenda";
import { CronMessage } from "../Models/CronMessage.ts";
import { sendWelcomeMessageProcessor } from "../utils/welcome.ts";

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client: ExtendedClient) {
		console.log(`Bot Listo como: ${client.user?.tag} ! `);

		await CommandLimits.find().then((res: ICommandLimits[]) => {
			res.forEach((command) => {
				client.setCommandLimit(command);
			});
		});
		await Money.find().then((res: IMoney[]) => {
			res.forEach((money) => {
				client.setMoneyConfig(money);
			});
		});

		cronEventsProcessor(client);
		voiceFarmingProcessor(client);
		activityProcessor(client);
		setInterval(async () => {
			sendWelcomeMessageProcessor(client);
		}, 36e5);
	},
};

async function cronEventsProcessor(client: ExtendedClient) {
	ExtendedClient.agenda = new Agenda({
		db: { address: process.env.MONGO_URI ?? "", collection: "agenda_jobs" },
		processEvery: "1 minute",
	});

	// Define el trabajo para enviar recordatorios
	ExtendedClient.agenda.define("send reminder", async (job: Job) => {
		const { username, userId, message, channelId } = job.attrs.data;
		const channel = client.channels.cache.get(channelId) as TextChannel;
		if (channel)
			await channel
				.send(`⏰ **<@${userId}>  Recordatorio:** ${message}`)
				.then(() => console.log(`Recordatorio enviado a ${username}`))
				.then(async () => await job.remove())
				.catch((error) => console.error(`Error al enviar recordatorio a ${username}:`, error));
	});

	// Define el trabajo para enviar mensajes cron
	ExtendedClient.agenda.define("send cron message", async (job: Job) => {
		const { channelId, content, embed, cronMessageId } = job.attrs.data;
		const channel = client.channels.cache.get(channelId) as TextChannel;
		if (channel) {
			const embedObject = embed ? new EmbedBuilder(embed) : null;
			await channel
				.send({
					content: content || undefined,
					embeds: embedObject ? [embedObject] : [],
				})
				.then((message) => console.log(`Mensaje cron enviado al canal ${channelId}`))
				.then(async () => (job.attrs.nextRunAt ? await CronMessage.deleteOne({ _id: cronMessageId }).exec() : null))
				.catch((error) => console.error(`Error al enviar mensaje cron al canal ${channelId}:`, error));
		}
	});

	await ExtendedClient.agenda.start();
}

async function voiceFarmingProcessor(client: ExtendedClient) {
	setInterval(() => {
		const now = new Date();
		const moneyConfig = client.getMoneyConfig(process.env.CLIENT_ID ?? "");
		const timeInterval = moneyConfig.voice.time;

		client.voiceFarmers.forEach(async (value, userId) => {
			console.log(value, userId);
			const timePassed = now.getTime() - value.date.getTime();
			const cyclesPassed = Math.floor(timePassed / timeInterval);
			console.log(cyclesPassed);

			if (cyclesPassed > value.count) {
				const cyclesToIncrement = cyclesPassed - value.count;
				value.count = cyclesPassed;
				Users.findOneAndUpdate(
					{ id: userId.toString() },
					{ $inc: { cash: moneyConfig.voice.coins * cyclesToIncrement } },
					{ upsert: true }
				).exec();
				client.voiceFarmers.set(userId, value);
			}
		});
	}, 6e4);
}

async function activityProcessor(client: ExtendedClient) {
	setInterval(() => {
		setTimeout(() => client.user?.setActivity("discord.gg/programacion", { type: ActivityType.Watching }), 1000);
		setTimeout(() => client.user?.setActivity("ella no te ama", { type: ActivityType.Watching }), 10000);
		setTimeout(() => client.user?.setActivity("+20 Millones de comentarios", { type: ActivityType.Watching }), 20000);
		setTimeout(() => client.user?.setActivity("PyE coins del #casino", { type: ActivityType.Competing }), 30000);
		setTimeout(
			() =>
				client.user?.setActivity(`a ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`, {
					type: ActivityType.Watching,
				}),
			40000
		);
	}, 50000);
}
