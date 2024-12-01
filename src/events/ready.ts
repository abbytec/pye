import { Events, ActivityType, EmbedBuilder, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.js";
import { Users } from "../Models/User.js";
import { Agenda, Job } from "agenda";
import { CronMessage } from "../Models/CronMessage.js";
import { sendWelcomeMessageProcessor } from "../utils/welcome.js";
import redisClient from "../redis.js";
import { getChannelFromEnv, getRoleFromEnv } from "../utils/constants.js";
import { capitalizeFirstLetter } from "../utils/generic.js";

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client: ExtendedClient) {
		console.log(`Bot Listo como: ${client.user?.tag} ! `);
		await client.updateClientData(true);
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
		const channel = (client.channels.cache.get(channelId) ?? client.channels.resolve(channelId)) as TextChannel;
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
		const channel = (client.channels.cache.get(channelId) ?? client.channels.resolve(channelId)) as TextChannel;
		if (channel) {
			const embedObject = embed ? new EmbedBuilder(embed) : null;
			await channel
				.send({
					content: content || undefined,
					embeds: embedObject ? [embedObject] : [],
				})
				.then(() => console.log(`Mensaje cron enviado al canal ${channelId}`))
				.then(async () => (job.attrs.nextRunAt ? await CronMessage.deleteOne({ _id: cronMessageId }).exec() : null))
				.catch((error) => console.error(`Error al enviar mensaje cron al canal ${channelId}:`, error));
		}
	});

	ExtendedClient.agenda.define("daily update client data", async (job: Job) => {
		await client.updateClientData();

		const now = new Date();
		const currentMonthNumber = now.getMonth();
		const currentMonthName = now.toLocaleString("default", { month: "long" }); // Nombre del mes en español

		if (!job.attrs.data) job.attrs.data = {};
		if (!job.attrs.data.userReps) {
			job.attrs.data.userReps = { month: currentMonthNumber };
			await job.save();
		}
		if (job.attrs.data.userReps.month !== currentMonthNumber) {
			// Actualiza el mes en los datos del trabajo

			let stats = ExtendedClient.trending.getStats();
			(client.channels.resolve(getChannelFromEnv("moderadores")) as TextChannel | null)?.send({
				embeds: [stats],
			});
			job.attrs.data.userReps.month = currentMonthNumber;
			await job.save();

			try {
				// Obtener todos los usuarios y sus puntos de 'top:rep'
				const allUsers = await redisClient.zRangeWithScores("top:rep", 0, -1, { REV: true });

				// Calcular el total de puntos sumando los scores de todos los usuarios
				const totalPoints = allUsers.reduce((acc, user) => acc + user.score, 0);

				let message = `**${capitalizeFirstLetter(
					currentMonthName
				)} se repartieron ${totalPoints} puntos de reputación en el servidor.**\n\n`;

				const medals = ["🥇", "🥈", "🥉"];

				if (allUsers.length === 0) {
					message += "No hay usuarios con puntos de reputación este mes.";
				} else {
					// Obtener los top 3 usuarios
					const topUsers = allUsers.slice(0, 3);
					for (let i = 0; i < topUsers.length; i++) {
						const userId = topUsers[i].value;
						const points = topUsers[i].score;
						message += `${medals[i]} <@${userId}> | ${points} puntos.\n`;
					}

					// Mencionar el rol y el usuario del mes
					const usuarioDelMesRoleId = getRoleFromEnv("usuarioDelMes");
					const topUserId = topUsers[0].value;
					message += `\nPor lo tanto el <@&${usuarioDelMesRoleId}> es <@${topUserId}>`;
					client.guilds.cache
						.get(process.env.GUILD_ID ?? "")
						?.members.fetch(topUserId)
						.then((member) => {
							member?.roles.add(usuarioDelMesRoleId).catch(null);
						});
					client.guilds.cache
						.get(process.env.GUILD_ID ?? "")
						?.roles.fetch(usuarioDelMesRoleId)
						.then((role) => {
							role?.members.forEach((member) => {
								member.roles.remove(usuarioDelMesRoleId).catch(null);
							});
						});
				}

				// Enviar el mensaje al canal "anuncios"
				const anunciosChannelId = getChannelFromEnv("anuncios");
				const channel = (await client.channels.fetch(anunciosChannelId)) as TextChannel;
				if (channel?.isTextBased()) await channel.send(message);

				// Reiniciar el ranking 'top:rep' para el próximo mes
				await redisClient.del("top:rep");
			} catch (error) {
				console.error("Error al procesar el top de reputación mensual:", error);
			}
		}
		ExtendedClient.trending.dailySave();
	});

	await ExtendedClient.agenda.start();
	// Verificar si ya existe un trabajo programado
	const existingJobs = await ExtendedClient.agenda.jobs({ name: "daily update client data" });

	if (existingJobs.length === 0) {
		// Programar el trabajo con condición de unicidad
		await ExtendedClient.agenda.every(
			"0 0 * * *",
			"daily update client data",
			{ userReps: { month: new Date().getMonth() } },
			{ skipImmediate: true }
		);
		console.log('Trabajo "daily update client data" programado.');
	} else {
		console.log('Trabajo "daily update client data" ya está programado.');
	}
}

async function voiceFarmingProcessor(client: ExtendedClient) {
	setInterval(() => {
		const now = new Date();
		const moneyConfig = client.getMoneyConfig(process.env.CLIENT_ID ?? "");
		const timeInterval = moneyConfig.voice.time;

		client.voiceFarmers.forEach(async (value, userId) => {
			const timePassed = now.getTime() - value.date.getTime();
			const cyclesPassed = Math.floor(timePassed / timeInterval);

			let voice = client.guilds.cache.get(process.env.GUILD_ID ?? "")?.members.cache.get(userId)?.voice;
			if (!voice) {
				client.voiceFarmers.delete(userId);
				return;
			}

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
