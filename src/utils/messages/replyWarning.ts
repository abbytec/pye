// replyWarning.ts
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	EmbedBuilder,
	RepliableInteraction,
	StringSelectMenuBuilder,
	TextChannel,
	User,
} from "discord.js";
import { COLORS } from "../constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export async function replyWarning(
	interaction:
		| IPrefixChatInputCommand
		| Pick<
				RepliableInteraction,
				"reply" | "editReply" | "deleteReply" | "followUp" | "replied" | "deferred" | "channelId" | "guild" | "user"
		  >,
	message: string | EmbedBuilder[],
	author?: User,
	components?: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[],
	files?: AttachmentBuilder[],
	content?: string,
	ephemeral = true
): Promise<void> {
	const messageToSend: any = { ephemeral: ephemeral };
	if (Array.isArray(message)) {
		messageToSend.embeds = message;
	} else {
		messageToSend.embeds = [
			new EmbedBuilder()
				.setAuthor({
					name: author?.tag ?? interaction.user.tag,
					iconURL: author?.displayAvatarURL() ?? interaction.user.displayAvatarURL(),
				})
				.setDescription("⚠️ • " + message)
				.setColor(COLORS.warnOrange)
				.setTimestamp(),
		];
	}
	if (components) messageToSend.components = components;
	if (files) messageToSend.files = files;
	if (content) messageToSend.content = content;

	if ((interaction.deferred || interaction.replied) && !components) {
		if (!ephemeral) {
			if ("_reply" in interaction) {
				await (await interaction.fetchReply()).delete().catch(() => null);
			} else {
				await interaction.deleteReply().catch(() => null);
			}
			(
				(interaction.guild?.channels.cache.get(interaction?.channelId ?? "") ??
					(await interaction.guild?.channels.fetch(interaction?.channelId ?? "").catch(() => undefined))) as TextChannel
			)
				?.send(messageToSend)
				.catch(() => null);
		} else await interaction.followUp(messageToSend).catch(() => null);
	} else if (components && (interaction.replied || interaction.deferred)) {
		await interaction.editReply(messageToSend).catch(() => null);
	} else {
		await interaction.reply(messageToSend).catch(() => null);
	}
}
