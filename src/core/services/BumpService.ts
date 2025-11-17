import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, Interaction, Message, TextChannel } from "discord.js";
import { Bumps } from "../../Models/Bump.js";
import { ExtendedClient } from "../../client.js";
import { addRep } from "../../commands/rep/add-rep.js";
import { COLORS, DISBOARD_UID, EMOJIS, getChannelFromEnv } from "../../utils/constants.js";
import { logHelperPoints } from "../../utils/logHelperPoints.js";
import { AgendaManager } from "../AgendaManager.js";
import { IService } from "../IService.js";
import ReminderService from "./ReminderService.js";

export default class BumpService implements IService {
	public readonly serviceName = "bump";
	private client: ExtendedClient;

	constructor(client: ExtendedClient) {
		this.client = client;
	}

	public start() {
		this.client.on(Events.MessageCreate, (message) => {
			if (message.author.id !== DISBOARD_UID || !message.inGuild()) return;
			void this.handleBump(message);
		});
	}

	public firstRun() {
		this.client.services.globalInteraction?.registerStartsWith("remind-me-too-bump", (interaction) =>
			this.addReminderRecipient(interaction)
		);
	}

	public async handleBump(message: Message) {
		if (
			message.author.id !== DISBOARD_UID ||
			!message.embeds.length ||
			message.embeds[0].data.color !== COLORS.lightSeaGreen ||
			!message.embeds[0].data.description?.includes(EMOJIS.thumbsUp)
		) {
			return;
		}

		try {
			if (!message.interactionMetadata || !message.guild) return;

			const bumperId = message.interactionMetadata.user.id;
			const bumper = await message.guild.members.fetch(bumperId);

			await Bumps.create({ user: bumperId, fecha: new Date() });

			const { member } = await addRep(bumperId, message.guild, 0.1);
			logHelperPoints(message.guild, `\`${member.user.username}\` ha obtenido 0.1 rep por compartir el servidor`);

			const reminderTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId(`remind-me-too-bump:${bumperId}`)
					.setLabel("¡Recuérdamelo a mí también!")
					.setStyle(ButtonStyle.Primary)
			);

			const embed = new EmbedBuilder()
				.setColor(COLORS.okGreen)
				.setAuthor({
					name: bumper.user.tag,
					iconURL: bumper.user.displayAvatarURL(),
				})
				.setDescription(
					`¡Gracias por ese bump, <@${bumperId}>!\nHas apoyado a nuestra querida comunidad y siento orgullo de ti.\nEn 2 horas avisaré cuando sea nuevamente momento de bumpear.`
				);

			await (message.channel as TextChannel)?.send({ embeds: [embed], components: [row] });

			await AgendaManager.getInstance()
				.cancel({ name: "bump reminder" })
				.catch(() => null);
			await AgendaManager.getInstance()
				.schedule(new Date(Date.now() + 24 * 60 * 60 * 1000), "bump reminder", {
					channelId: getChannelFromEnv("general"),
				})
				.catch(() => null);

			const reminderService = this.client.services.reminder as ReminderService;

			// Schedule channel reminder
			await reminderService.scheduleReminder({
				channelId: message.channel.id,
				reminderTime,
				embed: new EmbedBuilder()
					.setColor(COLORS.okGreen)
					.setDescription(
						`¡Ya se puede bumpear de nuevo! 🎉\nPuedes hacerlo escribiendo \`/bump\` y eligiendo la opción de <@${DISBOARD_UID}> para continuar apoyando al servidor.`
					),
			});

			// Schedule DM reminder
			const job = await reminderService.scheduleReminderDM({
				userIds: [bumperId],
				message: ``, // Empty message as embed is provided
				reminderTime,
				embed: new EmbedBuilder()
					.setDescription(`¡Ya puedes hacer bump de nuevo! 🎉\n<#${getChannelFromEnv("casino")}>`)
					.setColor(COLORS.okGreen),
			});

			if (job) {
				job.attrs.data.originalBumperId = bumperId;
				await job.save();
			}
		} catch (error: any) {
			console.error("Error al manejar el bump:", error);
			ExtendedClient.logError("Error al manejar el bump: " + error.message, error.stack, process.env.CLIENT_ID);
		}
	}

	public async addReminderRecipient(interaction: Interaction) {
		if (!interaction.isButton() || !interaction.customId.startsWith("remind-me-too-bump")) return;

		const bumperId = interaction.customId.split(":")[1];
		if (!bumperId) {
			await interaction.reply({
				content: "No pude identificar al usuario que hizo el bump original. Espera al próximo bump e intenta de nuevo.",
				ephemeral: true,
			});
			return;
		}

		try {
			const agenda = AgendaManager.getInstance();
			const jobs = await agenda.jobs({ name: "send reminder dm" });

			const relatedJob = jobs.find((job) => job.attrs.data.originalBumperId === bumperId);

			if (relatedJob) {
				const data = relatedJob.attrs.data;
				if (!data.userIds.includes(interaction.user.id)) {
					data.userIds.push(interaction.user.id);
					await relatedJob.save();
					await interaction.reply({ content: "¡Listo! Te recordaré también.", ephemeral: true });
				} else {
					await interaction.reply({ content: "Ya estabas en la lista de recordatorios.", ephemeral: true });
				}
			} else {
				await interaction.reply({ content: "No se encontró el recordatorio de bump original.", ephemeral: true });
			}
		} catch (error) {
			console.error("Error adding reminder recipient:", error);
			await interaction.reply({ content: "Hubo un error al agregarte al recordatorio.", ephemeral: true });
		}
	}
}
