import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonInteraction,
	ButtonStyle,
	EmbedBuilder,
	Events,
	Guild,
	Interaction,
	Message,
	MessageFlags,
	Role,
	TextChannel,
} from "discord.js";
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
	private readonly bumpReminderRoleName = "Recuerdame bumpear";
	private bumpReminderRoleId?: string;

	constructor(client: ExtendedClient) {
		this.client = client;
	}

	public start() {
		void this.ensureBumpReminderRole();
		this.client.on(Events.MessageCreate, (message) => {
			if (message.author.id !== DISBOARD_UID || !message.inGuild()) return;
			void this.handleBump(message);
		});
	}

	public firstRun() {
		this.client.services.globalInteraction?.register("remind-me-too-bump", (interaction) =>
			this.addReminderRecipient(interaction as ButtonInteraction)
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
			const bumpReminderRole = await this.ensureBumpReminderRole(message.guild);

			await Bumps.create({ user: bumperId, fecha: new Date() });

			const { member } = await addRep(bumperId, message.guild, 0.1);
			logHelperPoints(message.guild, `\`${member.user.username}\` ha obtenido 0.1 rep por compartir el servidor`);

			const reminderTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder().setCustomId("remind-me-too-bump").setLabel("¡Recuérdamelo a mí también!").setStyle(ButtonStyle.Primary)
			);

			const embed = new EmbedBuilder()
				.setColor(COLORS.okGreen)
				.setAuthor({
					name: bumper.user.tag,
					iconURL: bumper.user.displayAvatarURL(),
				})
				.setDescription(
					`¡Gracias por ese bump, <@${bumperId}>!\nHas apoyado a nuestra querida comunidad y siento orgullo de ti.\nEn 2 horas avisaré cuando sea nuevamente momento de bumpear.\n Tambien puedes bumpear ADC [aquí](https://disboard.org/es/server/538427518089166890).`
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

			await this.resetBumpReminderRoleMembers(bumpReminderRole, bumperId);

			const reminderService = this.client.services.reminder as ReminderService;

			// Schedule channel reminder
			await reminderService.scheduleReminder({
				channelId: message.channel.id,
				reminderTime,
				message: bumpReminderRole ? `<@&${bumpReminderRole.id}>` : undefined,
				embed: new EmbedBuilder()
					.setColor(COLORS.okGreen)
					.setDescription(
						`¡Ya se puede bumpear de nuevo! 🎉\nPuedes hacerlo escribiendo \`/bump\` y eligiendo la opción de <@${DISBOARD_UID}> para continuar apoyando al servidor.`
					),
			});
		} catch (error: any) {
			console.error("Error al manejar el bump:", error);
			ExtendedClient.logError("Error al manejar el bump: " + error.message, error.stack, process.env.CLIENT_ID);
		}
	}

	public async addReminderRecipient(interaction: ButtonInteraction) {
		const guild = interaction.guild ?? ExtendedClient.guild;
		if (!guild) {
			await interaction.reply({
				content: "No pude identificar el servidor para agregar el recordatorio. Intenta más tarde.",
				flags: MessageFlags.Ephemeral,
			});
			return;
		}

		try {
			const role = await this.ensureBumpReminderRole(guild);
			if (!role) {
				await interaction.reply({
					content: "No se pudo preparar el rol de recordatorios. Intenta más tarde.",
					flags: MessageFlags.Ephemeral,
				});
				return;
			}

			const wasAdded = await this.addUserToBumpReminderRole(role, interaction.user.id);
			if (wasAdded) {
				await interaction.reply({ content: "¡Listo! Te agregaré al próximo recordatorio.", flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content: "Ya estabas en la lista de recordatorios.", flags: MessageFlags.Ephemeral });
			}
		} catch (error) {
			console.error("Error adding reminder recipient:", error);
			await interaction.reply({ content: "Hubo un error al agregarte al recordatorio.", flags: MessageFlags.Ephemeral });
		}
	}

	private async ensureBumpReminderRole(guild?: Guild): Promise<Role | undefined> {
		const targetGuild =
			guild ??
			ExtendedClient.guild ??
			((await this.client.guilds.fetch(process.env.GUILD_ID ?? "").catch(() => undefined)) as Guild | undefined);

		if (!targetGuild) return undefined;

		if (this.bumpReminderRoleId) {
			const existingRole =
				targetGuild.roles.cache.get(this.bumpReminderRoleId) ??
				(await targetGuild.roles.fetch(this.bumpReminderRoleId).catch(() => null));
			if (existingRole) {
				return existingRole;
			}
			this.bumpReminderRoleId = undefined;
		}

		await targetGuild.roles.fetch();
		const normalized = this.bumpReminderRoleName.toLowerCase();
		const role = targetGuild.roles.cache.find((r) => r.name.toLowerCase() === normalized);

		if (role) {
			this.bumpReminderRoleId = role.id;
			return role;
		}

		try {
			const newRole = await targetGuild.roles.create({
				name: this.bumpReminderRoleName,
				reason: "Rol para los recordatorios de bump",
				permissions: [],
			});
			this.bumpReminderRoleId = newRole.id;
			return newRole;
		} catch (error) {
			console.error("No se pudo crear el rol de bump reminder:", error);
			return undefined;
		}
	}

	private async resetBumpReminderRoleMembers(role: Role | undefined, userId: string): Promise<void> {
		if (!role) return;
		try {
			await role.guild.members.fetch();
			const removalPromises = role.members.map((member) => member.roles.remove(role).catch(() => null));
			await Promise.all(removalPromises);
			await this.addUserToBumpReminderRole(role, userId);
		} catch (error) {
			console.error("Error al reiniciar los miembros del rol de bump reminder:", error);
		}
	}

	private async addUserToBumpReminderRole(role: Role | undefined, userId: string): Promise<boolean> {
		if (!role) return false;
		try {
			const member = role.guild.members.cache.get(userId) ?? (await role.guild.members.fetch(userId).catch(() => null));
			if (!member) return false;
			if (member.roles.cache.has(role.id)) return false;
			await member.roles.add(role).catch(() => null);
			return true;
		} catch (error) {
			console.error("Error al agregar usuario al rol de bump reminder:", error);
			return false;
		}
	}
}
