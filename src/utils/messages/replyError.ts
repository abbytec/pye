import { ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";

export async function replyError(interaction: ChatInputCommandInteraction, message: string, deferredOrReplied = false) {
	const embedMessage = {
		embeds: [
			new EmbedBuilder()
				.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
				.setDescription("<:cross_custom:913093934832578601> - " + message)
				.setColor(0xef5250)
				.setTimestamp(),
		],
		ephemeral: true,
	};
	if (interaction.deferred) {
		await interaction.deleteReply().catch(() => null);
		await (interaction.guild?.channels.resolve(interaction?.channelId) as TextChannel)?.send(embedMessage);
	} else {
		interaction.reply(embedMessage);
	}
	return { reactWarningMessage: null, reactOkMessage: null };
}
