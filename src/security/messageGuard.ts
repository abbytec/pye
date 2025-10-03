import {
	Message,
	GuildMember,
	TextChannel,
	User,
	ForumChannel,
	MediaChannel,
	NewsChannel,
	Guild,
	EmbedBuilder,
	MessageInteraction,
} from "discord.js";
import { ExtendedClient } from "../client.js";
import { AUTHORIZED_BOTS, COLORS, getChannelFromEnv, getRoleFromEnv } from "../utils/constants.js";
import { checkMentionSpam } from "./antiSpam/mentionSpamFilter.js";
import { spamFilter } from "./spamFilter.js";
import { checkAttachmentSpam } from "./antiSpam/attachmentSpamFilter.js";
import { checkUrlSpam } from "./antiSpam/urlSpamFilter.js";
import { floodBotsFilter } from "./antiSpam/floodBotsFilter.js";
import { checkCredentialLeak } from "./credentialLeakFilter.js";

export interface IDeletableContent {
	id: string;
	url: string;
	guild: Guild; // esto es para que funcione el delete, porque si no el this no me lo permite
	channel: NewsChannel | TextChannel | ForumChannel | MediaChannel | null;
	delete: (reason: string) => Promise<any>;
	createdTimestamp: number;
}

export async function messageGuard(message: Message<true>, client: ExtendedClient, isEdit = false) {
	if (
		!(
			message.channel.parentId === getChannelFromEnv("categoryStaff") ||
			message.member?.permissions.has("Administrator") ||
			client.staffMembers.includes(message.author.id) ||
			message.member?.roles.cache.has(getRoleFromEnv("instructorDeTaller")) ||
			AUTHORIZED_BOTS.includes(message.author.id)
		)
	) {
		let member: GuildMember | User | null = message.interactionMetadata?.user ?? null;
		if (member) {
			member = await message.guild?.members.fetch(member.id).catch(() => message.member);
		} else {
			member = message.member;
		}
		if (
			(await spamFilter(member, client, message as IDeletableContent, message.content)) ||
			(!isEdit &&
				((await floodBotsFilter(message, client)) ||
					(await checkMentionSpam(message, client)) ||
					(await checkUrlSpam(message, client)) ||
					(await checkAttachmentSpam(message, client))))
		)
			return true;
	}

	await checkCredentialLeak(message, client);

	if (message.author.bot && message.author.id !== process.env.CLIENT_ID && message.interaction)
		logCommand(message.interaction, message.author.displayName);
	return false;
}
function logCommand(message: MessageInteraction, botDisplayName: string) {
	(ExtendedClient.guild?.channels.cache.get(getChannelFromEnv("logMessages")) as TextChannel | undefined)
		?.send({
			embeds: [
				new EmbedBuilder().setColor(COLORS.pyeLightBlue).setFields([
					{
						name: "Autor",
						value: `\`${message.user.username}>\` (${message.user.id})`,
						inline: true,
					},
					{
						name: "Comando",
						value: `${botDisplayName} /${message.commandName}`,
						inline: true,
					},
				]),
			],
		})
		.catch(() => console.error("No se pudo enviar el log de mensajes"));
}
