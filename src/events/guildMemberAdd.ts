import { Events, GuildMember } from "discord.js";
import { ExtendedClient } from "../client.js";
import { Evento } from "../types/event.js";
import { getInitialRoles } from "../utils/constants.js";
import loadEnvVariables from "../utils/environment.js";

loadEnvVariables();

const regex = new RegExp(/(https?:\/\/[^\s]+)/i);
export default {
	name: Events.GuildMemberAdd,
	once: false,
	async execute(member: GuildMember) {
		if (regex.test(member?.user.displayName.toLocaleLowerCase())) return member.kick({ reason: "spam" });
		if (member.user.bot) return;
		member.roles.add(getInitialRoles(["novato"])).catch(() => null);
		if (process.env.ENABLE_AUTO_WELCOME_MESSAGE) ExtendedClient.newUsers.add(member.id);
	},
} as Evento;
