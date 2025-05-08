import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	EmbedBuilder,
	RepliableInteraction,
	StringSelectMenuBuilder,
	TextChannel,
} from "discord.js";
import { COLORS } from "../constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export async function replyOk(
	interaction:
		| IPrefixChatInputCommand
		| Pick<
				RepliableInteraction,
				"reply" | "editReply" | "deleteReply" | "followUp" | "replied" | "deferred" | "channelId" | "guild" | "user"
		  >,
	message: string | EmbedBuilder[],
	author?: string | null,
	components?: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[],
	files?: AttachmentBuilder[],
	content?: string,
	ephemeral = false
): Promise<void> {
	let messageToSend: any = { ephemeral: ephemeral };
	if (Array.isArray(message)) {
		messageToSend.embeds = message;
	} else {
		let authorMsg;
		if (author === null) authorMsg = null;
		else authorMsg = { name: author ?? interaction.user.tag, iconURL: interaction.user.displayAvatarURL() };
		messageToSend.embeds = [new EmbedBuilder().setAuthor(authorMsg).setDescription(message).setColor(COLORS.okGreen).setTimestamp()];
	}
	if (components) messageToSend.components = components;
	if (files) messageToSend.files = files;
	if (content) messageToSend.content = content;

	if ((interaction.deferred || interaction.replied) && !components) {
		if (!ephemeral) {
			if ("_reply" in interaction) {
				await (await interaction.fetchReply()).delete().catch((e) => null);
			} else {
				await interaction.deleteReply().catch((e) => null);
			}
			(
				(interaction.guild?.channels.cache.get(interaction?.channelId ?? "") ??
					(await interaction.guild?.channels.fetch(interaction?.channelId ?? "").catch(() => undefined))) as TextChannel
			)
				?.send(messageToSend)
				.catch((e) => null);
		} else await interaction.followUp(messageToSend).catch((e) => null);
	} else if (components && (interaction.replied || interaction.deferred)) {
		await interaction.editReply(messageToSend).catch((e) => console.log(e));
	} else {
		await interaction.reply(messageToSend).catch((e) => console.log(e));
	}
}
