import { ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";

export async function replyOk(interaction: ChatInputCommandInteraction, message: string, author?: string) {
	const embedMessage = {
		embeds: [
			new EmbedBuilder()
				.setAuthor({ name: author ?? interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
				.setDescription("✅ • " + message)
				.setColor(0x43b581)
				.setTimestamp(),
		],
		ephemeral: true,
	};
	if (interaction.deferred) {
		await interaction.deleteReply().catch((e) => console.error(e));
		await (interaction.guild?.channels.resolve(interaction?.channelId) as TextChannel)?.send(embedMessage);
	} else {
		interaction.reply(embedMessage);
	}
	return { reactWarningMessage: null, reactOkMessage: null };
}
