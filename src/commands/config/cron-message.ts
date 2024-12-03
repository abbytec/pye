// commands/admin/cron-message.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { CronMessage } from "../../Models/CronMessage.js";
import { ExtendedClient } from "../../client.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { DateTime } from "luxon";

export default {
	group: "⚙️ - Administración - General",
	data: new SlashCommandBuilder()
		.setName("cron-message")
		.setDescription("Gestiona mensajes programados")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.addSubcommand((subcommand) => subcommand.setName("view").setDescription("Ver todos los mensajes programados"))
		.addSubcommand((subcommand) =>
			subcommand
				.setName("add")
				.setDescription("Agregar un nuevo mensaje programado")
				.addChannelOption((option) =>
					option
						.setName("canal")
						.setDescription("Canal donde se enviará el mensaje")
						.setRequired(true)
						.addChannelTypes(ChannelType.GuildText)
				)
				.addStringOption((option) =>
					option.setName("content").setDescription("Contenido del mensaje").setRequired(false).setMaxLength(2000)
				)
				.addStringOption((option) => option.setName("embed").setDescription("Embed en formato JSON").setRequired(false))
				.addStringOption((option) => option.setName("startdate").setDescription("Fecha de inicio (YYYY-MM-DD HH:mm)").setRequired(false))
				.addIntegerOption((option) => option.setName("minutes").setDescription("Minutos (0-59)").setRequired(false))
				.addIntegerOption((option) => option.setName("hours").setDescription("Horas (0-23)").setRequired(false))
				.addIntegerOption((option) => option.setName("days").setDescription("Días del mes (1-31)").setRequired(false))
				.addIntegerOption((option) => option.setName("months").setDescription("Meses (1-12)").setRequired(false))
				.addBooleanOption((option) => option.setName("repeat").setDescription("¿Repetir el mensaje?").setRequired(false))
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("remove")
				.setDescription("Eliminar un mensaje programado")
				.addStringOption((option) => option.setName("id").setDescription("ID del mensaje a eliminar").setRequired(true))
		),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: ChatInputCommandInteraction) => {
			const subcommand = interaction.options.getSubcommand();

			if (subcommand === "view") {
				// Obtiene todos los mensajes programados de la base de datos
				const cronMessages = await CronMessage.find();
				if (cronMessages.length === 0) {
					return replyWarning(interaction, "No hay mensajes programados.");
				}

				// Crea un embed con la lista de mensajes programados
				const embed = new EmbedBuilder().setTitle("📋 Mensajes Programados").setColor(0x00ae86).setTimestamp();

				cronMessages.forEach((cronMsg) => {
					embed.addFields({
						name: `🔢 ID: ${cronMsg.id}`,
						value: `**Canal:** <#${cronMsg.channelId}>\n**Cron:** \`${cronMsg.cron}\`\n**Contenido:** ${
							cronMsg.content ?? "N/A"
						}\n**Embed:** ${cronMsg.embed ? "✅ Sí" : "❌ No"}\n**Repetir:** ${cronMsg.repeat ? "✅ Sí" : "❌ No"}`,
					});
				});

				return replyOk(interaction, [embed], undefined, undefined, undefined, undefined, true);
			} else if (subcommand === "add") {
				const content = interaction.options.getString("content") ?? null;
				const embedJson = interaction.options.getString("embed") ?? null;
				const channel = interaction.options.getChannel("canal", true);
				const startDateInput = interaction.options.getString("startdate") ?? null;
				const minutes = interaction.options.getInteger("minutes") ?? "*";
				const hours = interaction.options.getInteger("hours") ?? "*";
				const days = interaction.options.getInteger("days") ?? "*";
				const months = interaction.options.getInteger("months") ?? "*";
				const repeat = interaction.options.getBoolean("repeat") ?? false;

				let embedData = null;
				if (embedJson) {
					try {
						embedData = JSON.parse(embedJson);
					} catch (error) {
						return replyError(interaction, "El embed proporcionado no es un JSON válido.");
					}
				}

				// Valida que al menos contenido o embed esté presente
				if (!content && !embedData) {
					return replyError(interaction, "Debes proporcionar al menos contenido o un embed.");
				}

				// Procesa startDate
				let startDate: Date = new Date();
				if (startDateInput) {
					const parsedDate = DateTime.fromFormat(startDateInput, "yyyy-MM-dd HH:mm", {
						zone: "utc",
					});
					if (!parsedDate.isValid) {
						return replyError(interaction, "La fecha de inicio no tiene un formato válido. Usa 'YYYY-MM-DD HH:mm'.");
					}
					startDate = parsedDate.toJSDate();
				}

				// Genera el cron string
				const cronParts = [
					typeof minutes === "number" ? `*/${minutes}` : "*",
					typeof hours === "number" ? `*/${hours}` : "*",
					typeof days === "number" ? `*/${days}` : "*",
					typeof months === "number" ? `*/${months}` : "*",
					"*", // Día de la semana
				];
				const cronString = cronParts.join(" ");

				// Guarda el mensaje programado en la base de datos
				const cronMessage = new CronMessage({
					channelId: channel.id,
					content: content,
					embed: embedData,
					cron: cronString,
					startDate: startDate,
					repeat: repeat,
				});

				try {
					const savedCronMessage = await cronMessage.save();
					const jobData = {
						channelId: channel.id,
						content: content,
						embed: embedData,
						cronMessageId: savedCronMessage.id,
					};

					// Programa el trabajo con Agenda
					if (repeat) {
						// Trabajo recurrente
						await ExtendedClient.agenda.every(cronString, "send cron message", jobData, {
							startDate: startDate,
						});
					} else {
						// Trabajo único
						const job = ExtendedClient.agenda.create("send cron message", { ...jobData, cronMessageId: savedCronMessage.id });
						job.unique({ cronMessageId: savedCronMessage.id });
						job.schedule(startDate);
						await job.save();
					}

					return replyOk(interaction, `Mensaje programado con éxito.`, undefined, undefined, undefined, undefined, true);
				} catch (error) {
					console.error("Error al agregar mensaje programado:", error);
					return replyError(interaction, "Hubo un error al agregar el mensaje programado.");
				}
			} else if (subcommand === "remove") {
				const id = interaction.options.getString("id", true);

				// Busca y elimina el mensaje programado de la base de datos
				try {
					await CronMessage.findOneAndDelete({ _id: id });

					// Cancela el trabajo en Agenda
					await ExtendedClient.agenda.cancel({ "data.cronMessageId": id });

					return replyOk(
						interaction,
						`Mensaje programado con ID \`${id}\` eliminado.`,
						undefined,
						undefined,
						undefined,
						undefined,
						true
					);
				} catch (error) {
					console.error("Error al eliminar mensaje programado:", error);
					return replyError(interaction, "Hubo un error al eliminar el mensaje programado.");
				}
			}
		}
	),
};
