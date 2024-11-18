// voiceStateUpdate.ts
import { Events, VoiceState } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { EventoConClienteForzado } from "../types/event.ts";

export default {
	name: Events.VoiceStateUpdate,
	once: false,
	async executeWithClient(client: ExtendedClient, oldState: VoiceState, newState: VoiceState) {
		const userId = newState.member?.id ?? oldState.member?.id;
		if (!userId) return;

		// Member joins a voice channel
		if (!oldState.channelId && newState.channelId) {
			client.voiceFarmers.set(userId, { date: new Date(), count: 0 });
		}
		// Member leaves all voice channels
		else if (oldState.channelId && !newState.channelId) {
			client.voiceFarmers.delete(userId);
		}
	},
} as EventoConClienteForzado;
