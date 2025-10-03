import { Job } from "agenda";
import { TextChannel } from "discord.js";
import { IService } from "../IService.js";
import { ExtendedClient } from "../../client.js";
import { Users } from "../../Models/User.js";
import { Bumps } from "../../Models/Bump.js";
import redisClient from "../../redis.js";
import { getChannelFromEnv, getRoleFromEnv } from "../../utils/constants.js";
import { capitalizeFirstLetter } from "../../utils/generic.js";
import { addRep } from "../../commands/rep/add-rep.js";
import { logHelperPoints } from "../../utils/logHelperPoints.js";
import { AgendaManager } from "../AgendaManager.js";

export default class CommunityRewardsService implements IService {
	public readonly serviceName = "communityRewards";

	constructor(private readonly client: ExtendedClient) {}

	async start() {
		const agenda = AgendaManager.getInstance();

		// Define el trabajo para recompensas semanales a los boosters
		agenda.define("weekly booster rep", async () => {
			const guild = this.client.guilds.cache.get(process.env.GUILD_ID ?? "") ?? 
				(await this.client.guilds.fetch(process.env.GUILD_ID ?? ""));
			
			if (!guild) return;
			
			const boosterRole = getRoleFromEnv("nitroBooster");
			const members = await guild.members.fetch();
			
			for (const member of members.filter((m) => m.roles.cache.has(boosterRole)).values()) {
				await addRep(member.user, guild, 1).then(({ member: mem }) =>
					logHelperPoints(guild, `\`${mem.user.username}\` ha obtenido 1 rep por seguir siendo Booster`)
				);
			}
		});

		// Define el trabajo para actualización diaria de datos del cliente
		agenda.define("daily update client data", async (job: Job) => {
			await this.client.updateClientData().catch((error) => console.error(error));

			const now = new Date();
			const currentMonthNumber = now.getMonth();
			const lastMonthName = new Date(2024, currentMonthNumber - 1, 1).toLocaleString("es", { month: "long" });

			if (!job.attrs.data) job.attrs.data = {};
			if (!job.attrs.data.userReps) {
				job.attrs.data.userReps = { month: currentMonthNumber };
				await job.save().catch((error) => console.error(error));
			}
			
			if (job.attrs.data.userReps.month !== currentMonthNumber) {
				// Actualiza el mes en los datos del trabajo
				const stats = await this.client.services.trending.getStats(this.client);
				(this.client.channels.resolve(getChannelFromEnv("staff")) as TextChannel | null)
					?.send({ embeds: [stats] })
					.catch((error) => {
						ExtendedClient.logError(
							"Error al enviar el embed de tendencias: " + error.message, 
							error.stack, 
							process.env.CLIENT_ID
						);
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
					// Obtener todos los usuarios y sus puntos del top de reputación
					const rawData = await redisClient.sendCommand<string[]>(["ZREVRANGE", "top:rep", "0", "3", "WITHSCORES"]);

					// Parsear el resultado
					const allUsers: Array<{ value: string; score: number }> = [];
					for (let i = 0; i < rawData.length; i += 2) {
						allUsers.push({
							value: rawData[i],
							score: Number(rawData[i + 1]),
						});
					}

					// Calcular el total de puntos
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
						
						this.client.guilds.cache
							.get(process.env.GUILD_ID ?? "")
							?.roles.fetch(usuarioDelMesRoleId)
							.then((role) => {
								role?.members.forEach((member) => {
									member.roles.remove(usuarioDelMesRoleId).catch(null);
								});
							})
							.catch(null);
						
						this.client.guilds.cache
							.get(process.env.GUILD_ID ?? "")
							?.members.fetch(topUserId)
							.then((member) => {
								member?.roles.add(usuarioDelMesRoleId).catch(null);
							})
							.catch(null);
					}

					// Enviar el mensaje al canal "anuncios"
					const anunciosChannelId = getChannelFromEnv("anuncios");
					const channel = (await this.client.channels.fetch(anunciosChannelId).catch(() => undefined)) as TextChannel;
					if (channel?.isTextBased()) await channel.send(message);

					// Reiniciar el ranking top - reputación para el próximo mes
					await redisClient.del("top:rep");
				} catch (error) {
					console.error("Error al procesar el top de reputación mensual:", error);
				}
			}
			
			this.client.services.trending.dailySave().catch((error) => {
				console.error("Error al guardar el top de tendencias:", error);
			});

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

		// Define el trabajo para recordatorio de bump
		agenda.define("bump reminder", async (job: Job) => {
			const { channelId } = job.attrs.data as { channelId: string };
			const channel = (this.client.channels.cache.get(channelId) ?? 
				this.client.channels.resolve(channelId)) as TextChannel;
			
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

		// Programar los trabajos
		await this.scheduleJobs();
		
		console.log("✅ CommunityRewardsService iniciado correctamente");
	}

	private async scheduleJobs() {
		const agenda = AgendaManager.getInstance();

		// Programar daily update client data
		const [existingJob] = await agenda.jobs({ name: "daily update client data" });
		if (!existingJob) {
			await agenda.every(
				"0 0 * * *",
				"daily update client data",
				{ userReps: { month: new Date().getMonth() } },
				{ skipImmediate: true, timezone: "UTC" }
			);
			console.log('Trabajo "daily update client data" programado.');
		} else {
			console.log('Trabajo "daily update client data" ya está programado.');
		}

		// Programar weekly booster rep
		const boosterJobs = await agenda.jobs({ name: "weekly booster rep" });
		if (boosterJobs.length === 0) {
			await agenda.every("0 0 * * 1", "weekly booster rep", undefined, { skipImmediate: true });
			console.log('Trabajo "weekly booster rep" programado.');
		} else {
			console.log('Trabajo "weekly booster rep" ya está programado.');
		}

		// Programar bump reminder
		const bumpJobs = await agenda.jobs({ name: "bump reminder" });
		if (bumpJobs.length === 0) {
			const lastBump = await Bumps.findOne().sort({ fecha: -1 }).exec();
			const nextRunAt = lastBump ? new Date(lastBump.fecha.getTime() + 36 * 60 * 60 * 1000) : new Date();
			await agenda.schedule(nextRunAt, "bump reminder", {
				channelId: getChannelFromEnv("general"),
			});
			console.log('Trabajo "bump reminder" programado.');
		} else {
			console.log('Trabajo "bump reminder" ya está programado.');
		}
	}
}

