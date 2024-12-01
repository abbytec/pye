// voiceStateUpdate.ts
import { EmbedBuilder, Events, TextChannel, VoiceState } from "discord.js";
import { ExtendedClient } from "../client.js";
import { EventoConClienteForzado } from "../types/event.js";
import { COLORS, getChannelFromEnv } from "../utils/constants.js";

export default {
	name: Events.VoiceStateUpdate,
	once: false,
	async executeWithClient(client: ExtendedClient, oldState: VoiceState, newState: VoiceState) {
		const userId = newState.member?.id ?? oldState.member?.id;
		const isBot = newState.member?.user.bot ?? oldState.member?.user.bot;
		if (!userId || isBot) return;

		const logChannel = (client.channels.cache.get(getChannelFromEnv("voiceLogs")) ??
			client.channels.resolve(getChannelFromEnv("voiceLogs"))) as TextChannel;

		let embed = new EmbedBuilder().setTimestamp();

		// Member joins a voice channel
		if (!oldState.channelId && newState.channelId) {
			embed.setColor(COLORS.okGreen);
			embed.setTitle(`${newState.member?.user.tag} has joined a voice channel.`);
			embed.setFields(
				{ name: "Channel", value: newState.channel?.name ?? "Unknown", inline: true },
				{ name: "Member Count", value: `${newState.channel?.members.size ?? 0}`, inline: true }
			);
			client.voiceFarmers.set(userId, { date: new Date(), count: 0 });
		}
		// Member leaves all voice channels
		else if (oldState.channelId && !newState.channelId) {
			embed.setColor(COLORS.errRed);
			embed.setTitle(`${oldState.member?.user.tag} has left a voice channel.`);
			embed.setFields(
				{ name: "Channel", value: oldState.channel?.name ?? "Unknown", inline: true },
				{ name: "Member Count", value: `${oldState.channel?.members.size ?? 0}`, inline: true }
			);
			client.voiceFarmers.delete(userId);
		} else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
			embed.setColor(COLORS.warnOrange);
			embed.setTitle(`${oldState.member?.user.tag} has moved to a different voice channel.`);
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
		embed.addFields({ name: "User ID", value: userId, inline: false });

		if (embed.data.title) await logChannel.send({ embeds: [embed] });
	},
} as EventoConClienteForzado;
