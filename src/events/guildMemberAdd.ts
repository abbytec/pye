import { Events, GuildMember } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { EventoConClienteForzado } from "../types/event.ts";
import { getInitialRoles, getRoleFromEnv } from "../utils/constants.ts";

const regex = new RegExp(/(https?:\/\/[^\s]+)/i);
export default {
	name: Events.GuildMemberAdd,
	once: false,
	async executeWithClient(client: ExtendedClient, member: GuildMember) {
		if (regex.test(member?.user.displayName.toLocaleLowerCase())) return member.ban({ reason: "spam" });
		member.roles.add(getInitialRoles()).catch(() => null);
		client.newUsers.add(member.id);
	},
} as EventoConClienteForzado;
