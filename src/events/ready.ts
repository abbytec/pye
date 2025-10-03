import { Events, EmbedBuilder, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.js";
import { Users } from "../Models/User.js";
import { Bumps } from "../Models/Bump.js";
import { Agenda, Job } from "agenda";
import { CronMessage } from "../Models/CronMessage.js";
import { sendWelcomeMessageProcessor } from "../utils/welcome.js";
import redisClient from "../redis.js";
import { getChannelFromEnv, getRoleFromEnv } from "../utils/constants.js";
import { capitalizeFirstLetter } from "../utils/generic.js";
// import { getDailyChallenge } from "../utils/challenges/dailyChallenge.js";
import { createPyechanEmbed, MASCOT_AUTHOR, MASCOT_THUMBNAIL } from "../utils/messages/createPyechanEmbed.js";
import { addRep } from "../commands/rep/add-rep.js";
import { logHelperPoints } from "../utils/logHelperPoints.js";

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client: ExtendedClient) {
		console.log(`Bot Listo como: ${client.user?.tag} ! `);
		await client.updateClientData(true);

		try {
			const invites = await ExtendedClient.guild?.invites.fetch();
			invites?.forEach((inv) => client.invites.set(inv.code, inv.uses ?? 0));
		} catch (error) {
			console.error("Error al obtener las invitaciones:", error);
		}

		cronEventsProcessor(client);
		if (process.env.ENABLE_AUTO_WELCOME_MESSAGE)
			setInterval(async () => {
				sendWelcomeMessageProcessor(client);
			}, 36e5);
	},
};

async function cronEventsProcessor(client: ExtendedClient) {
	ExtendedClient.agenda = new Agenda(
		{
			db: { address: process.env.MONGO_URI ?? "", collection: "agenda_jobs" },
			processEvery: "1 minute",
		},
		(error) => {
			if (error) ExtendedClient.logError(error.message);
		}
	);

	ExtendedClient.agenda.on("error", (error) => {
		console.error(error);
		ExtendedClient.logError(error.message);
	});

	// Define el trabajo para enviar recordatorios
	ExtendedClient.agenda.define("send reminder dm", async (job: Job) => {
		const { userId, message } = job.attrs.data;
		console.log(`Enviando recordatorio por DM a ${userId}`);
		const guild = client.guilds.cache.get(process.env.GUILD_ID ?? "") ?? (await client.guilds.fetch(process.env.GUILD_ID ?? ""));
		if (!guild) return;
		const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));
		if (member)
			await member
				.send(`⏰ **<@${userId}>  Recordatorio:** ${message}`)
				.then(() => console.log(`Recordatorio por DM enviado a ${userId}`))
				.then(async () => await job.remove())
				.catch((error) => console.error(`Error al enviar recordatorio a ${userId} via DM:`, error));
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
				.then(async () => (job.attrs.nextRunAt ? await CronMessage.deleteOne({ _id: cronMessageId }).exec() : null))
				.catch((error) => console.error(`Error al enviar mensaje cron al canal ${channelId}:`, error));
		}
	});

	ExtendedClient.agenda.define("weekly booster rep", async () => {
		const guild = client.guilds.cache.get(process.env.GUILD_ID ?? "") ?? (await client.guilds.fetch(process.env.GUILD_ID ?? ""));
		if (!guild) return;
		const boosterRole = getRoleFromEnv("nitroBooster");
		const members = await guild.members.fetch();
		for (const member of members.filter((m) => m.roles.cache.has(boosterRole)).values())
			await addRep(member.user, guild, 1).then(({ member: mem }) =>
				logHelperPoints(guild, `\`${mem.user.username}\` ha obtenido 1 rep por seguir siendo Booster`)
			);
	});

	ExtendedClient.agenda.define("daily update client data", async (job: Job) => {
		await client.updateClientData().catch((error) => console.error(error));

		const now = new Date();
		const currentMonthNumber = now.getMonth();
		const lastMonthName = new Date(2024, currentMonthNumber - 1, 1).toLocaleString("es", { month: "long" }); // Nombre del mes en español

		if (!job.attrs.data) job.attrs.data = {};
		if (!job.attrs.data.userReps) {
			job.attrs.data.userReps = { month: currentMonthNumber };
			await job.save().catch((error) => console.error(error));
		}
		if (job.attrs.data.userReps.month !== currentMonthNumber) {
			// Actualiza el mes en los datos del trabajo

			const stats = await client.services.trending.getStats(client);
			(client.channels.resolve(getChannelFromEnv("staff")) as TextChannel | null)
				?.send({
					embeds: [stats],
				})
				.catch((error) => {
					ExtendedClient.logError("Error al enviar el embed de tendencias: " + error.message, error.stack, process.env.CLIENT_ID);
				});
			job.attrs.data.userReps.month = currentMonthNumber;
			await job.save().catch((error) => {
				ExtendedClient.logError(
					"Error al actualizar el mes en los datos del cron worker 'daily update client data': " + error.message,
					error.stack,
					process.env.CLIENT_ID
				);
			});

			try {
				// Obtener todos los usuarios y sus puntos del top de reputacion
				const rawData = await redisClient.sendCommand<string[]>(["ZREVRANGE", "top:rep", "0", "3", "WITHSCORES"]);

				// Luego parseas el resultado:
				const allUsers: Array<{ value: string; score: number }> = [];
				for (let i = 0; i < rawData.length; i += 2) {
					allUsers.push({
						value: rawData[i],
						score: Number(rawData[i + 1]),
					});
				}

				// Calcular el total de puntos sumando los scores de todos los usuarios
				const totalPoints = allUsers.reduce((acc, user) => acc + user.score, 0);

				let message = `En **${capitalizeFirstLetter(
					lastMonthName
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
						?.roles.fetch(usuarioDelMesRoleId)
						.then((role) => {
							role?.members.forEach((member) => {
								member.roles.remove(usuarioDelMesRoleId).catch(null);
							});
						})
						.catch(null);
					client.guilds.cache
						.get(process.env.GUILD_ID ?? "")
						?.members.fetch(topUserId)
						.then((member) => {
							member?.roles.add(usuarioDelMesRoleId).catch(null);
						})
						.catch(null);
				}

				// Enviar el mensaje al canal "anuncios"
				const anunciosChannelId = getChannelFromEnv("anuncios");
				const channel = (await client.channels.fetch(anunciosChannelId).catch(() => undefined)) as TextChannel;
				if (channel?.isTextBased()) await channel.send(message);

				// Reiniciar el ranking top - reputación para el próximo mes
				await redisClient.del("top:rep");
			} catch (error) {
				console.error("Error al procesar el top de reputación mensual:", error);
			}
		}
		client.services.trending.dailySave().catch((error) => {
			console.error("Error al guardar el top de tendencias:", error);
		});
		/* if (process.env.NODE_ENV !== "development" && now.getDate() % 3 === 0)
			await getDailyChallenge(client).catch((error) => console.error(error)); */

		// Actualiza el top de bumps
		await redisClient
			.sendCommand<string[]>(["ZREVRANGE", "top:bump", "0", "0"])
			.then(async (top) => {
				if (!top || top.length === 0) return;
				const topId = top[0];
				await Users.updateOne({ id: topId }, { $inc: { dailyBumpTops: 1 } });
				// Limpia el ranking
				await redisClient.del("top:bump");
			})
			.catch((error) => console.error(error));
	});

	ExtendedClient.agenda.define("bump reminder", async (job: Job) => {
		const { channelId } = job.attrs.data as { channelId: string };
		const channel = (client.channels.cache.get(channelId) ?? client.channels.resolve(channelId)) as TextChannel;
		if (channel) {
			const casinoId = getChannelFromEnv("casinoPye");
			await channel
				.send(
					"☕✨ Hagamos que nuestro cafecito llegue a más gente ✨☕\nSi tienen un momento, pasen por <#" +
						casinoId +
						"> y usen /bump 💬\nCada bump ayuda a que más personas nos encuentren y se unan a compartir charlas, risas y código 💖"
				)
				.catch((error) => console.error("Error al enviar recordatorio de bump:", error));
		}
		job.schedule(new Date(Date.now() + 36 * 60 * 60 * 1000));
		await job.save();
	});

	await ExtendedClient.agenda.start();
	// Verificar si ya existe un trabajo programado
	const [existingJob] = await ExtendedClient.agenda.jobs({ name: "daily update client data" });

	if (!existingJob) {
		// Programar el trabajo con condición de unicidad
		await ExtendedClient.agenda.every(
			"0 0 * * *",
			"daily update client data",
			{ userReps: { month: new Date().getMonth() } },
			{ skipImmediate: true, timezone: "UTC" }
		);
		console.log('Trabajo "daily update client data" programado.');
	} else {
		console.log('Trabajo "daily update client data" ya está programado.');
	}

	const boosterJobs = await ExtendedClient.agenda.jobs({ name: "weekly booster rep" });
	if (boosterJobs.length === 0) {
		await ExtendedClient.agenda.every("0 0 * * 1", "weekly booster rep", undefined, { skipImmediate: true });
		console.log('Trabajo "weekly booster rep" programado.');
	} else {
		console.log('Trabajo "weekly booster rep" ya está programado.');
	}

	const bumpJobs = await ExtendedClient.agenda.jobs({ name: "bump reminder" });
	if (bumpJobs.length === 0) {
		const lastBump = await Bumps.findOne().sort({ fecha: -1 }).exec();
		const nextRunAt = lastBump ? new Date(lastBump.fecha.getTime() + 36 * 60 * 60 * 1000) : new Date();
		await ExtendedClient.agenda.schedule(nextRunAt, "bump reminder", {
			channelId: getChannelFromEnv("general"),
		});
		console.log('Trabajo "bump reminder" programado.');
	} else {
		console.log('Trabajo "bump reminder" ya está programado.');
	}
}
