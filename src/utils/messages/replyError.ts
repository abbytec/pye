// replyWarning.ts
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	Interaction,
	RepliableInteraction,
	StringSelectMenuBuilder,
	TextChannel,
} from "discord.js";
import { COLORS } from "../constants.js";

export async function replyError(
	interaction: RepliableInteraction,
	message: string | EmbedBuilder[],
	author?: string,
	components?: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[],
	files?: AttachmentBuilder[],
	content?: string,
	ephemeral = true
): Promise<void> {
	let messageToSend: any = { ephemeral: ephemeral };
	if (Array.isArray(message)) {
		messageToSend.embeds = message;
	} else {
		messageToSend.embeds = [
			new EmbedBuilder()
				.setAuthor({ name: author ?? interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
				.setDescription("❌ • " + message)
				.setColor(COLORS.errRed)
				.setTimestamp(),
		];
	}
	if (components) messageToSend.components = components;
	if (files) messageToSend.files = files;
	if (content) messageToSend.content = content;

	if ((interaction.deferred || interaction.replied) && !components) {
		if (!ephemeral) {
			await interaction.deleteReply().catch((e) => null);
			await (interaction.guild?.channels.resolve(interaction?.channelId ?? "") as TextChannel)?.send(messageToSend);
		} else await interaction.followUp(messageToSend);
	} else if (components) {
		await interaction.editReply(messageToSend).catch((e) => null);
	} else {
		await interaction.reply(messageToSend);
	}
}
