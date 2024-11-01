// replyWarning.ts
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ChatInputCommandInteraction,
	EmbedBuilder,
	StringSelectMenuBuilder,
	TextChannel,
} from "discord.js";

export async function replyWarning(
	interaction: ChatInputCommandInteraction,
	message: string | EmbedBuilder[],
	author?: string,
	components?: (ActionRowBuilder<ButtonBuilder> | ActionRowBuilder<StringSelectMenuBuilder>)[],
	files?: AttachmentBuilder[],
	ephemeral = true
): Promise<void> {
	let messageToSend: any = { ephemeral: ephemeral };
	if (Array.isArray(message)) {
		messageToSend.embeds = message;
	} else {
		messageToSend.embeds = [
			new EmbedBuilder()
				.setAuthor({ name: author ?? interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
				.setDescription(process.env.NODE_ENV === "development" ? "⚠️ • " + message : "<:warning_custom:913093934832578601> • " + message)
				.setColor(0xffae42)
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
		await interaction.reply(messageToSend);
	}
}
