import { AuditLogEvent, EmbedBuilder, Events, TextChannel, VoiceState } from "discord.js";
import { CoreClient } from "../CoreClient.js";
import { IService } from "../IService.js";
import { ExtendedClient } from "../../client.js";
import { COLORS, getChannelFromEnv, getRoleFromEnv } from "../../utils/constants.js";
import { ModLogs } from "../../Models/ModLogs.js";

export default class VoiceWatcherService implements IService {
	public readonly serviceName = "voiceWatcher";

	constructor(private readonly client: CoreClient) {}

	start() {
		this.client.on(Events.VoiceStateUpdate, (oldState, newState) => this.onVoiceStateUpdate(oldState, newState));
	}

	private async onVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
		const client = this.client as ExtendedClient;
		const userId = newState.member?.user.id ?? oldState.member?.user.id;
		const isBot = newState.member?.user.bot ?? oldState.member?.user.bot;
		if (!userId || isBot) return;

		let logChannel = (client.channels.cache.get(getChannelFromEnv("voiceLogs")) ??
			client.channels.resolve(getChannelFromEnv("voiceLogs"))) as TextChannel;
		const errorLogChannel = (client.channels.cache.get(getChannelFromEnv("logs")) ??
			client.channels.resolve(getChannelFromEnv("logs"))) as TextChannel;

		let embed = new EmbedBuilder().setTimestamp();

		if (!oldState.channelId && newState.channelId) {
			if ((newState.member?.joinedAt?.getTime() ?? 0) > Date.now() - 600000) {
				const userMuted = await ModLogs.findOne({
					id: userId,
					type: "Voice-mute",
					reasonUnpenalized: { $exists: false },
				});
				if (userMuted) {
					await newState.member?.voice.setMute(true).catch(() => null);
					await newState.member?.roles.add(getRoleFromEnv("silenced")).catch(() => null);
				}
			}
			embed
				.setColor(COLORS.okGreen)
				.setAuthor({
					name: newState.member?.user.tag ?? "Usuario",
					iconURL: newState.member?.user.displayAvatarURL(),
				})
				.setDescription(`<@${userId}> se unió a un canal de voz.`)
				.setFields(
					{ name: "Canal", value: newState.channel?.name ?? "Desconocido", inline: true },
					{ name: "Miembros", value: `${newState.channel?.members.size ?? 0}`, inline: true }
				);
			client.services.economy.voiceFarmers.set(userId, { date: new Date(), count: 0 });
		} else if (oldState.channelId && !newState.channelId) {
			embed
				.setAuthor({
					name: oldState.member?.user.tag ?? "Usuario",
					iconURL: oldState.member?.user.displayAvatarURL(),
				})
				.setColor(COLORS.errRed)
				.setDescription(`<@${oldState.member?.user.id}> salió de un canal de voz.`)
				.setFields(
					{ name: "Canal", value: oldState.channel?.name ?? "Desconocido", inline: true },
					{ name: "Miembros", value: `${oldState.channel?.members.size ?? 0}`, inline: true }
				);
			client.services.economy.voiceFarmers.delete(userId);
		} else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
			embed
				.setColor(COLORS.warnOrange)
				.setAuthor({
					name: oldState.member?.user.tag ?? "Usuario",
					iconURL: oldState.member?.user.displayAvatarURL(),
				})
				.setDescription(`<@${oldState.member?.user.id}> se movió a un canal de voz diferente.`)
				.setFields(
					{
						name: "Canal Anterior",
						value: `${oldState.channel?.name ?? "Desconocido"} (${oldState.channel?.members.size ?? 0} miembros)`,
						inline: false,
					},
					{
						name: "Nuevo Canal",
						value: `${newState.channel?.name ?? "Desconocido"} (${newState.channel?.members.size ?? 0} miembros)`,
						inline: false,
					}
				);
		}

		const deafChange = oldState.serverDeaf !== newState.serverDeaf;
		const silenceChange = oldState.serverMute !== newState.serverMute;

		if (embed.data.description)
			await logChannel.send({ embeds: [embed] }).catch(() =>
				errorLogChannel
					.send({
						content: "Error al intentar loguear eventos de canales de voz.",
						embeds: [embed],
					})
					.catch(() => null)
			);

		if (deafChange || silenceChange) {
			logChannel = (client.channels.cache.get(getChannelFromEnv("bansanciones")) ??
				client.channels.resolve(getChannelFromEnv("bansanciones"))) as TextChannel;
			embed = new EmbedBuilder().setTimestamp();
			let desc = "";
			if (deafChange) {
				embed.setColor(newState.serverDeaf ? COLORS.warnOrange : COLORS.okGreen);
				embed.setAuthor({
					name: newState.member?.user.tag ?? "Usuario",
					iconURL: newState.member?.user.displayAvatarURL(),
				});
				desc = `<@${newState.member?.user.id}> ${
					newState.serverDeaf ? "fue ensordecido manualmente" : "fue des-ensordecido manualmente"
				}.`;
			} else if (silenceChange) {
				embed.setColor(newState.serverMute ? COLORS.warnOrange : COLORS.okGreen);
				embed.setAuthor({
					name: newState.member?.user.tag ?? "Usuario",
					iconURL: newState.member?.user.displayAvatarURL(),
				});
				desc = `<@${newState.member?.user.id}> ${
					newState.serverMute ? "fue silenciado manualmente" : "fue des-silenciado manualmente"
				}.`;
			}

			const auditLogs = await newState.guild
				.fetchAuditLogs({
					limit: 2,
					type: AuditLogEvent.MemberUpdate,
				})
				.catch(() => undefined);

			const auditEntry = auditLogs?.entries.find((entry) => entry.target?.id === userId && entry.createdAt.getTime() > Date.now() - 60000);
			if (auditEntry) {
				const executor = auditEntry.executor;
				desc = desc + (executor ? `\n Por: **${executor.tag}**` : "");
				embed.setDescription(desc);
				await logChannel.send({ embeds: [embed] }).catch(() =>
					errorLogChannel
						.send({
							content: "Error al intentar loguear eventos de canales de voz.",
							embeds: [embed],
						})
						.catch(() => null)
				);
			}
		}
	}
}

