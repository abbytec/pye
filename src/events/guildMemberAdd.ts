import { Events, GuildMember } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { EventoConClienteForzado } from "../types/event.ts";

const regex = new RegExp(/(https?:\/\/[^\s]+)/i);
export default {
	name: Events.GuildMemberAdd,
	once: false,
	async executeWithClient(client: ExtendedClient, member: GuildMember) {
		if (regex.test(member?.user.displayName.toLocaleLowerCase())) return member.ban({ reason: "spam" });
		client.newUsers.add(member.id);
	},
} as EventoConClienteForzado;
