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

// Cache de IDs para evitar llamadas repetidas
const CATEGORY_STAFF_ID = getChannelFromEnv("categoryStaff");
const INSTRUCTOR_ROLE_ID = getRoleFromEnv("instructorDeTaller");
const LOG_MESSAGES_CHANNEL_ID = getChannelFromEnv("logMessages");

export interface IDeletableContent {
	id: string;
	url: string;
	guild: Guild; // esto es para que funcione el delete, porque si no el this no me lo permite
	channel: NewsChannel | TextChannel | ForumChannel | MediaChannel | null;
	delete: (reason: string) => Promise<any>;
	createdTimestamp: number;
}

export async function messageGuard(message: Message<true>, client: ExtendedClient, isEdit = false) {
	// Retorno temprano para bots autorizados
	if (message.author.bot && AUTHORIZED_BOTS.includes(message.author.id)) {
		if (message.author.id !== process.env.CLIENT_ID && message.interaction) {
			logCommand(message.interaction, message.author.displayName);
		}
		return false;
	}

	// Retorno temprano para usuarios privilegiados (más rápido, evita verificaciones innecesarias)
	const isStaffCategory = message.channel.parentId === CATEGORY_STAFF_ID;
	const isAdmin = message.member?.permissions.has("Administrator");
	const isStaffMember = client.staffMembers.includes(message.author.id);
	const hasInstructorRole = message.member?.roles.cache.has(INSTRUCTOR_ROLE_ID);

	const isPrivilegedUser = isStaffCategory || isAdmin || isStaffMember || hasInstructorRole;

	if (!isPrivilegedUser) {
		let member: GuildMember | User | null = message.member;
		if (message.interactionMetadata?.user && !member) {
			member = await message.guild?.members.fetch(message.interactionMetadata.user.id).catch(() => message.member);
		}

		const [isSpam, isURLSpam] = await Promise.all([
			spamFilter(member, client, message as IDeletableContent, message.content),
			checkUrlSpam(message, client),
		]);
		if (isSpam || isURLSpam) return true;

		if (!isEdit) {
			const [isFloodBot, isMentionSpam, isAttachmentSpam] = await Promise.all([
				floodBotsFilter(message, client),
				checkMentionSpam(message, client),
				checkAttachmentSpam(message, client),
			]);

			if (isFloodBot || isMentionSpam || isAttachmentSpam) {
				return true;
			}
		}
	}

	checkCredentialLeak(message, client).catch(() => {});

	return false;
}
function logCommand(message: MessageInteraction, botDisplayName: string) {
	const logChannel = ExtendedClient.guild?.channels.cache.get(LOG_MESSAGES_CHANNEL_ID) as TextChannel | undefined;

	if (!logChannel) return;

	logChannel
		.send({
			embeds: [
				new EmbedBuilder().setColor(COLORS.pyeLightBlue).setFields([
					{
						name: "Autor",
						value: `\`${message.user.username}\` (${message.user.id})`,
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
		.catch(() => {});
}
