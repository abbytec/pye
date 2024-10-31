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
	files?: AttachmentBuilder[]
): Promise<PostHandleable> {
	let embedMessage: {
		embeds?: EmbedBuilder[];
		ephemeral: boolean;
	} = { ephemeral: true };
	if (Array.isArray(message)) {
		embedMessage.embeds = message;
	} else {
		embedMessage.embeds = [
			new EmbedBuilder()
				.setAuthor({ name: author ?? interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
				.setDescription("✅ • " + message)
				.setColor(0x43b581)
				.setTimestamp(),
		];
	}

	if (interaction.deferred && !components) {
		await interaction.deleteReply().catch((e) => null);
		await (interaction.guild?.channels.resolve(interaction?.channelId) as TextChannel)?.send(embedMessage);
	} else if (components || files) {
		let messageToSend: any = { embeds: embedMessage.embeds };
		if (components) messageToSend.components = components;
		if (files) messageToSend.files = files;
		await interaction.editReply(messageToSend).catch((e) => null);
	} else {
		interaction.reply(embedMessage);
	}
	return { reactWarningMessage: null, reactOkMessage: null };
}
