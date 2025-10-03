import {
	ActionRowBuilder,
	ChannelType,
	Events,
	GuildMember,
	ModalBuilder,
	ModalSubmitInteraction,
	PermissionFlagsBits,
	StringSelectMenuBuilder,
	StringSelectMenuInteraction,
	TextInputBuilder,
	TextInputStyle,
	UserSelectMenuBuilder,
	UserSelectMenuInteraction,
	VoiceChannel,
	VoiceState,
} from "discord.js";
import { ExtendedClient } from "../../client.js";
import { IService } from "../IService.js";
import { TempVoiceChannel } from "../../Models/TempVoiceChannel.js";
import { getChannelFromEnv } from "../../utils/constants.js";

const CREATOR_CHANNEL_NAME = "Crea tu sala";

export default class TempVoiceService implements IService {
	public readonly serviceName = "tempVoice";
	private readonly channels = new Map<string, string>(); // channelId -> ownerId
	private creatorChannelId: string | undefined;

	constructor(private readonly client: ExtendedClient) {}

	async start() {
		this.client.on(Events.VoiceStateUpdate, (oldState, newState) => this.handleVoiceStateUpdate(oldState, newState));
		await this.ensureCreatorChannel();
		await this.loadExistingChannels();
		const interactions = this.client.services.globalInteraction;
		interactions.register("tempvoice-menu", (i) => this.handleMenu(i as StringSelectMenuInteraction));
		interactions.register("tempvoice-rename", (i) => this.handleRename(i as ModalSubmitInteraction));
		interactions.registerStartsWith("tempvoice-block:", (i) => this.handleBlock(i as UserSelectMenuInteraction));
		interactions.registerStartsWith("tempvoice-allow:", (i) => this.handleAllow(i as UserSelectMenuInteraction));
	}

	private async ensureCreatorChannel() {
		const guild = ExtendedClient.guild;
		if (!guild) return;
		let channel = guild.channels.cache.find(
			(c) => c.type === ChannelType.GuildVoice && c.parentId === getChannelFromEnv("categoryVoz") && c.name === CREATOR_CHANNEL_NAME
		) as VoiceChannel | undefined;
		channel ??= await guild.channels
			.create({
				name: CREATOR_CHANNEL_NAME,
				type: ChannelType.GuildVoice,
				parent: getChannelFromEnv("categoryVoz"),
				permissionOverwrites: [
					{
						id: guild.roles.everyone.id,
						allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel],
						deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.Speak],
					},
				],
			})
			.catch(() => {
				ExtendedClient.logError("Error creando el canal de creación de salas de voz");
				return undefined;
			});
		this.creatorChannelId = channel?.id;
	}

	private async loadExistingChannels() {
		const docs = await TempVoiceChannel.find().lean().exec();
		const guild = ExtendedClient.guild;
		for (const doc of docs) {
			this.channels.set(doc.channelId, doc.ownerId);
			const chan = guild?.channels.cache.get(doc.channelId) as VoiceChannel | undefined;
			if (!chan || chan.members.size === 0) {
				await TempVoiceChannel.deleteOne({ channelId: doc.channelId }).catch(() => null);
				await chan?.delete().catch(() => null);
				this.channels.delete(doc.channelId);
			}
		}
	}

	public async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
		const member = newState.member ?? oldState.member;
		if (!member || member.user.bot) return;

		if (newState.channelId === this.creatorChannelId) {
			await this.createPrivateChannel(member);
			return;
		}

		if (oldState.channelId && oldState.channelId !== newState.channelId && this.channels.has(oldState.channelId)) {
			const channel = oldState.channel as VoiceChannel | null;
			if (channel) {
				setTimeout(async () => {
					const remainingMembers = channel.members.filter((m) => !m.user.bot);
					if (remainingMembers.size === 0) {
						await channel.delete().catch(() => null);
						await TempVoiceChannel.deleteOne({ channelId: channel.id }).catch(() => null);
						this.channels.delete(channel.id);
					}
				}, 1000);
			}
		}
	}

	private async createPrivateChannel(member: GuildMember) {
		const channel = await member.guild.channels
			.create({
				name: `Sala de ${member.displayName}`,
				type: ChannelType.GuildVoice,
				parent: getChannelFromEnv("categoryVoz"),
				permissionOverwrites: [
					{
						id: member.id,
						allow: [
							PermissionFlagsBits.Connect,
							PermissionFlagsBits.Speak,
							PermissionFlagsBits.ViewChannel,
							PermissionFlagsBits.MoveMembers,
						],
					},
					{
						id: member.guild.roles.everyone.id,
						allow: [PermissionFlagsBits.Connect],
					},
					{
						id: process.env.CLIENT_ID ?? "",
						allow: [
							PermissionFlagsBits.ViewChannel,
							PermissionFlagsBits.Connect,
							PermissionFlagsBits.MoveMembers,
							PermissionFlagsBits.ManageChannels,
						],
					},
				],
			})
			.catch((e) => console.error("Error creando el canal privado", e));
		if (!channel) return;
		this.channels.set(channel.id, member.id);
		await TempVoiceChannel.create({
			channelId: channel.id,
			ownerId: member.id,
			blocked: [],
			isPublic: true,
			status: "",
		}).catch(() => null);
		await channel
			.send({
				content: `Bienvenido a tu nuevo canal, ${member}!`,
				components: [this.buildMenu(true)],
			})
			.catch(() => null);
		await member.voice.setChannel(channel).catch(() => null);
	}

	private buildMenu(isPublic: boolean) {
		const menu = new StringSelectMenuBuilder()
			.setCustomId("tempvoice-menu")
			.setPlaceholder("Opciones del canal")
			.addOptions(
				{ label: "Cambiar nombre", value: "rename" },
				{ label: isPublic ? "Hacer privado" : "Hacer público", value: "toggle" },
				{ label: "Bloquear usuario", value: "block" },
				...(!isPublic ? [{ label: "Permitir usuario", value: "allow" }] : [])
			);
		return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
	}

	private async handleMenu(interaction: StringSelectMenuInteraction) {
		const owner = this.channels.get(interaction.channelId);
		if (owner !== interaction.user.id) {
			await interaction.reply({ content: "No eres el dueño del canal.", ephemeral: true });
			return;
		}
		const doc = await TempVoiceChannel.findOne({ channelId: interaction.channelId }).exec();
		if (!doc) return;
		const choice = interaction.values[0];
		if (choice === "rename") {
			const modal = new ModalBuilder()
				.setCustomId("tempvoice-rename")
				.setTitle("Cambiar nombre")
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>().addComponents(
						new TextInputBuilder().setCustomId("name").setLabel("Nuevo nombre").setStyle(TextInputStyle.Short).setRequired(true)
					)
				);
			await interaction.showModal(modal);
			return;
		}
		if (choice === "toggle") {
			const everyone = interaction.guild?.roles.everyone.id;
			const channel = interaction.channel as VoiceChannel | null;
			if (!channel || !everyone) return;

			await interaction.deferUpdate();

			if (doc.isPublic) {
				await channel.permissionOverwrites.edit(everyone, { Connect: false }).catch(() => null);
				doc.isPublic = false;
				await doc.save().catch(() => null);
				await interaction.followUp({ content: "Canal ahora es privado.", ephemeral: true });
			} else {
				await channel.permissionOverwrites.edit(everyone, { Connect: true }).catch(() => null);
				doc.isPublic = true;
				await doc.save().catch(() => null);
				await interaction.followUp({ content: "Canal ahora es público.", ephemeral: true });
			}

			await interaction.editReply({ components: [this.buildMenu(doc.isPublic)] }).catch(() => null);
			return;
		}
		if (choice === "block") {
			await interaction.reply({
				content: "Selecciona un usuario para bloquear",
				components: [
					new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
						new UserSelectMenuBuilder().setCustomId(`tempvoice-block:${interaction.channelId}`).setPlaceholder("Selecciona usuario")
					),
				],
				ephemeral: true,
			});
			return;
		}
		if (choice === "allow") {
			if (!doc.isPublic) {
				await interaction.reply({ content: "El canal no es público.", ephemeral: true });
				return;
			}
			await interaction.reply({
				content: "Selecciona un usuario para permitir",
				components: [
					new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
						new UserSelectMenuBuilder().setCustomId(`tempvoice-allow:${interaction.channelId}`).setPlaceholder("Selecciona usuario")
					),
				],
				ephemeral: true,
			});
			return;
		}
	}

	private async handleRename(interaction: ModalSubmitInteraction) {
		const channel = interaction.channel as VoiceChannel | null;
		if (!channel) return;
		const owner = this.channels.get(channel.id);
		if (owner !== interaction.user.id) {
			await interaction.reply({ content: "No eres el dueño del canal.", ephemeral: true });
			return;
		}
		const name = interaction.fields.getTextInputValue("name");
		await channel.setName(name).catch(() => null);
		await interaction.reply({ content: "Nombre actualizado.", ephemeral: true });
	}

	private async handleBlock(interaction: UserSelectMenuInteraction) {
		const channelId = interaction.customId.split(":")[1];
		const channel = interaction.guild?.channels.cache.get(channelId) as VoiceChannel | undefined;
		if (!channel) return;
		const owner = this.channels.get(channel.id);
		if (owner !== interaction.user.id) {
			await interaction.update({ content: "No eres el dueño del canal.", components: [] });
			return;
		}
		const userId = interaction.values[0];
		await channel.permissionOverwrites.edit(userId, { Connect: false }).catch(() => null);
		await TempVoiceChannel.updateOne({ channelId: channel.id }, { $addToSet: { blocked: userId } }).catch(() => null);
		await interaction.update({ content: `Usuario <@${userId}> bloqueado.`, components: [] });
	}

	private async handleAllow(interaction: UserSelectMenuInteraction) {
		const channelId = interaction.customId.split(":")[1];
		const channel = interaction.guild?.channels.cache.get(channelId) as VoiceChannel | undefined;
		if (!channel) return;
		const owner = this.channels.get(channel.id);
		if (owner !== interaction.user.id) {
			await interaction.update({ content: "No eres el dueño del canal.", components: [] });
			return;
		}
		const userId = interaction.values[0];
		await channel.permissionOverwrites.delete(userId).catch(() => null);
		await TempVoiceChannel.updateOne({ channelId: channel.id }, { $pull: { blocked: userId } }).catch(() => null);
		await interaction.update({ content: `Usuario <@${userId}> permitido.`, components: [] });
	}
}

