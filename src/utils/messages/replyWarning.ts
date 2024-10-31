// replyWarning.ts

import { ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { PostHandleable } from "../../types/middleware.ts";

export async function replyWarning(interaction: ChatInputCommandInteraction, message: string): Promise<PostHandleable> {
	const embedMessage = {
		embeds: [
			new EmbedBuilder()
				.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
				.setDescription(process.env.NODE_ENV === "development" ? "⚠️ • " + message : "<:warning_custom:913093934832578601> • " + message)
				.setColor(0xffae42)
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
