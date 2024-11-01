import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	StringSelectMenuBuilder,
	TextChannel,
} from "discord.js";
import { PostHandleable } from "../../types/middleware.ts";

export async function replyOk(
	interaction: ChatInputCommandInteraction,
	message: string | EmbedBuilder[],
	author?: string,
	components?: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[],
	files?: AttachmentBuilder[],
	ephemeral = false
): Promise<PostHandleable> {
	let messageToSend: any = { ephemeral: ephemeral };
	if (Array.isArray(message)) {
		messageToSend.embeds = message;
	} else {
		messageToSend.embeds = [
			new EmbedBuilder()
				.setAuthor({ name: author ?? interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
				.setDescription("✅ • " + message)
				.setColor(0x43b581)
				.setTimestamp(),
		];
	}
	if (components) messageToSend.components = components;
	if (files) messageToSend.files = files;

	if ((interaction.deferred || interaction.replied) && !components) {
		await interaction.deleteReply().catch((e) => null);
		await (interaction.guild?.channels.resolve(interaction?.channelId) as TextChannel)?.send(messageToSend);
	} else if (components) {
		await interaction.editReply(messageToSend).catch((e) => null);
	} else {
		interaction.reply(messageToSend);
	}
	return { reactWarningMessage: null, reactOkMessage: null };
}
