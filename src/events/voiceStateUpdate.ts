// voiceStateUpdate.ts
import { AuditLogEvent, EmbedBuilder, Events, TextChannel, VoiceState } from "discord.js";
import { ExtendedClient } from "../client.js";
import { EventoConClienteForzado } from "../types/event.js";
import { COLORS, getChannelFromEnv, getRoleFromEnv } from "../utils/constants.js";
import { ModLogs } from "../Models/ModLogs.js";

export default {
	name: Events.VoiceStateUpdate,
	once: false,
	async executeWithClient(client: ExtendedClient, oldState: VoiceState, newState: VoiceState) {
		const userId = newState.member?.user.id ?? oldState.member?.user.id;
		const isBot = newState.member?.user.bot ?? oldState.member?.user.bot;
		if (!userId || isBot) return;
		let logChannel = (client.channels.cache.get(getChannelFromEnv("voiceLogs")) ??
			client.channels.resolve(getChannelFromEnv("voiceLogs"))) as TextChannel;

		let embed = new EmbedBuilder().setTimestamp();

		// Member joins a voice channel
		if (!oldState.channelId && newState.channelId) {
			if ((newState.member?.joinedAt?.getTime() ?? 0) > Date.now() - 60000) {
				let userMuted = await ModLogs.findOne({ id: userId, type: "Voice-mute", reasonUnpenalized: { $exists: false } });
				if (userMuted) {
					await newState.member?.voice.setMute(true).catch(() => null);
					await newState.member?.roles.add(getRoleFromEnv("silenced")).catch(() => null);
				}
			}
			embed.setColor(COLORS.okGreen);
			embed.setAuthor({ name: newState.member?.user.tag ?? "Usuario", iconURL: newState.member?.user.displayAvatarURL() });
			embed.setDescription(`<@${userId}> has joined a voice channel.`);
			embed.setFields(
				{ name: "Channel", value: newState.channel?.name ?? "Unknown", inline: true },
				{ name: "Member Count", value: `${newState.channel?.members.size ?? 0}`, inline: true }
			);
			client.voiceFarmers.set(userId, { date: new Date(), count: 0 });
		}
		// Member leaves all voice channels
		else if (oldState.channelId && !newState.channelId) {
			embed.setAuthor({ name: oldState.member?.user.tag ?? "Usuario", iconURL: oldState.member?.user.displayAvatarURL() });
			embed.setColor(COLORS.errRed);
			embed.setDescription(`<@${oldState.member?.user.id}> has left a voice channel.`);
			embed.setFields(
				{ name: "Channel", value: oldState.channel?.name ?? "Unknown", inline: true },
				{ name: "Member Count", value: `${oldState.channel?.members.size ?? 0}`, inline: true }
			);
			client.voiceFarmers.delete(userId);
		} else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
			embed.setColor(COLORS.warnOrange);
			embed.setAuthor({ name: oldState.member?.user.tag ?? "Usuario", iconURL: oldState.member?.user.displayAvatarURL() });
			embed.setDescription(`<@${oldState.member?.user.id}> has moved to a different voice channel.`);
			embed.setFields(
				{
					name: "Previous Channel",
					value: `${oldState.channel?.name ?? "Unknown"} (${oldState.channel?.members.size ?? 0} members)`,
					inline: false,
				},
				{
					name: "New Channel",
					value: `${newState.channel?.name ?? "Unknown"} (${newState.channel?.members.size ?? 0} members)`,
					inline: false,
				}
			);
		}
		// mute o silence manuales
		const deafChange = oldState.serverDeaf !== newState.serverDeaf;
		const silenceChange = oldState.serverMute !== newState.serverMute;
		if (embed.data.description) await logChannel.send({ embeds: [embed] });

		if (deafChange || silenceChange) {
			logChannel = (client.channels.cache.get(getChannelFromEnv("bansanciones")) ??
				client.channels.resolve(getChannelFromEnv("bansanciones"))) as TextChannel;
			embed = new EmbedBuilder().setTimestamp();
			let desc = "";
			if (deafChange) {
				embed.setColor(newState.serverDeaf ? COLORS.warnOrange : COLORS.okGreen);
				embed.setAuthor({ name: newState.member?.user.tag ?? "Usuario", iconURL: newState.member?.user.displayAvatarURL() });
				desc = `<@${newState.member?.user.id}> ${
					newState.serverDeaf ? "fue ensordecido manualmente" : "fue des-ensordecido manualmente"
				}.`;
			} else if (silenceChange) {
				embed.setColor(newState.serverMute ? COLORS.warnOrange : COLORS.okGreen);
				embed.setAuthor({ name: newState.member?.user.tag ?? "Usuario", iconURL: newState.member?.user.displayAvatarURL() });
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

			const auditEntry = auditLogs?.entries.find((entry) => {
				return entry.target?.id === userId && entry.createdAt.getTime() > Date.now() - 60000;
			});
			if (auditEntry) {
				const executor = auditEntry.executor;
				desc = desc + (executor ? `\n Por: **${executor.tag}**` : "");
				embed.setDescription(desc);
				await logChannel.send({ embeds: [embed] });
			}
		}
	},
} as EventoConClienteForzado;
