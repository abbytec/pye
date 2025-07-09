import {
	Events,
	ActivityType,
	EmbedBuilder,
	TextChannel,
	StringSelectMenuOptionBuilder,
	StringSelectMenuBuilder,
	ActionRowBuilder,
} from "discord.js";
import { ExtendedClient } from "../client.js";
import { Users } from "../Models/User.js";
import { Agenda, Job } from "agenda";
import { CronMessage } from "../Models/CronMessage.js";
import { sendWelcomeMessageProcessor } from "../utils/welcome.js";
import redisClient from "../redis.js";
import { COLORS, getChannelFromEnv, getRoleFromEnv } from "../utils/constants.js";
import { capitalizeFirstLetter } from "../utils/generic.js";
import { ticketOptions } from "../utils/constants/ticketOptions.js";
import { getDailyChallenge } from "../utils/challenges/dailyChallenge.js";
import AutoRoleService from "../core/services/AutoRoleService.js";

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client: ExtendedClient) {
		console.log(`Bot Listo como: ${client.user?.tag} ! `);
		await client.updateClientData(true);
		ticketProcessor(client);
		cronEventsProcessor(client);
		voiceFarmingProcessor(client);
		activityProcessor(client);
		setInterval(async () => {
			if (process.env.ENABLE_AUTO_WELCOME_MESSAGE) sendWelcomeMessageProcessor(client);
			await AutoRoleService.borrarRolesTemporales();
		}, 36e5);
	},
};

async function ticketProcessor(client: ExtendedClient) {
	const ticketChannel =
		(client.channels.cache.get(getChannelFromEnv("tickets")) as TextChannel) ??
		(client.channels.resolve(getChannelFromEnv("tickets")) as TextChannel);
	if (!ticketChannel) return ExtendedClient.logError("Ticket channel not found", "", client.user?.id);

	let ticketMessage = await ticketChannel.messages.fetch({ limit: 2 }).then((m) => {
		const message = m.filter((m) => m.author.id === process.env.CLIENT_ID).first();
		if (message?.author.id === process.env.CLIENT_ID) return message;
	});

	const selectMenu = new StringSelectMenuBuilder().setCustomId("ticket_select").setPlaceholder("Selecciona una opción");
	ticketOptions.forEach((option) => {
		selectMenu.addOptions(
			new StringSelectMenuOptionBuilder()
				.setLabel(option.button.charAt(0).toUpperCase() + option.button.slice(1))
				.setDescription(option.description)
				.setEmoji(option.emoji)
				.setValue(option.type)
		);
	});
	const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

	const embed = new EmbedBuilder()
		.setAuthor({ iconURL: client.user?.displayAvatarURL(), name: "Gestión de tickets" })
		.setThumbnail(client.guilds.cache.get(process.env.GUILD_ID ?? "")?.iconURL() ?? null)
		.setTitle("Elije el tipo de ticket a abrir")
		.setDescription(
			`Abajo puedes elegir el tipo de ticket que deseas abrir para hablar con los administradores.\n\nPara consultas de programación utiliza: \n<#${getChannelFromEnv(
				"chatProgramadores"
			)}>`
		)
		.setColor(COLORS.pyeLightBlue)
		.setTimestamp();

	if (ticketMessage) {
		if (process.env.UPDATE_TICKET_MESSAGE === "true")
			await ticketChannel.send({ embeds: [embed], components: [row] }).then(async () => {
				await ticketMessage.delete().catch(() => null);
			});
	} else {
		await ticketChannel.send({ embeds: [embed], components: [row] });
	}
}

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
			const embedObject = embed ? new EmbedBuilder(embed) : null;
			await channel
				.send({
					content: content ?? undefined,
					embeds: embedObject ? [embedObject] : [],
				})
				.then(() => console.log(`Mensaje cron enviado al canal ${channelId}`))
				.then(async () => (job.attrs.nextRunAt ? await CronMessage.deleteOne({ _id: cronMessageId }).exec() : null))
				.catch((error) => console.error(`Error al enviar mensaje cron al canal ${channelId}:`, error));
		}
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

			let stats = await client.services.trending.getStats(client);
			(client.channels.resolve(getChannelFromEnv("moderadores")) as TextChannel | null)
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
		if (process.env.NODE_ENV !== "development" && now.getDate() % 3 === 0)
			await getDailyChallenge(client).catch((error) => console.error(error));

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
		const moneyConfig = client.services.economy.getConfig(process.env.CLIENT_ID ?? "");
		const timeInterval = moneyConfig.voice.time;

		client.services.economy.voiceFarmers.forEach(async (value, userId) => {
			const timePassed = now.getTime() - value.date.getTime();
			const cyclesPassed = Math.floor(timePassed / timeInterval);

			let voice = client.guilds.cache.get(process.env.GUILD_ID ?? "")?.members.cache.get(userId)?.voice;
			if (!voice) {
				client.services.economy.voiceFarmers.delete(userId);
				return;
			}

			if (cyclesPassed > value.count) {
				const cyclesToIncrement = cyclesPassed - value.count;
				value.count = cyclesPassed;
				Users.findOneAndUpdate(
					{ id: userId.toString() },
					{ $inc: { cash: moneyConfig.voice.coins * cyclesToIncrement } },
					{ upsert: true, new: true }
				).exec();
				client.services.economy.voiceFarmers.set(userId, value);
			}
		});
	}, 6e4);
}
const URL_State = "🔗 discord.gg/programacion";
async function activityProcessor(client: ExtendedClient) {
	setInterval(() => {
		setTimeout(() => client.user?.setActivity("discord.gg/programacion", { type: ActivityType.Watching, state: URL_State }), 1000);
		setTimeout(() => client.user?.setActivity("ella no te ama, pyechan tampoco", { type: ActivityType.Watching, state: URL_State }), 10000);
		setTimeout(() => client.user?.setActivity("+20 Millones de comentarios", { type: ActivityType.Watching, state: URL_State }), 20000);
		setTimeout(
			() => client.user?.setActivity("PyE coins en el Casino (#comandos)", { type: ActivityType.Competing, state: URL_State }),
			30000
		);
		setTimeout(
			() =>
				client.user?.setActivity(`a ${client.guilds.cache.get(process.env.GUILD_ID ?? "")?.memberCount ?? "👀"}`, {
					type: ActivityType.Watching,
					state: URL_State,
				}),
			40000
		);
	}, 50000);
}
