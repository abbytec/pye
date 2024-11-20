import { Events, GuildMember } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { Evento } from "../types/event.ts";
import { getInitialRoles } from "../utils/constants.ts";

const regex = new RegExp(/(https?:\/\/[^\s]+)/i);
export default {
	name: Events.GuildMemberAdd,
	once: false,
	async execute(member: GuildMember) {
		if (regex.test(member?.user.displayName.toLocaleLowerCase())) return member.ban({ reason: "spam" });
		if (member.user.bot) return;
		member.roles.add(getInitialRoles()).catch(() => null);
		ExtendedClient.newUsers.add(member.id);
	},
} as Evento;
