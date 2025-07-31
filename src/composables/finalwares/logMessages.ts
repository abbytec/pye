import { EmbedBuilder, GuildMember, TextChannel } from "discord.js";
import { Finalware } from "../../types/middleware.js";

export const logMessages: Finalware = async (postHandleableInteraction, result) => {
	result.logMessages?.forEach((message) => {
		if ("content" in message && message.content) {
			((postHandleableInteraction.member as GuildMember).guild.channels.resolve(message.channel) as TextChannel)
				?.send(message.content)
				.catch(() => console.error("Error al enviar el mensaje de log"));
		} else if ("user" in message) {
			const embed = new EmbedBuilder()
				.setAuthor({ name: message.user.tag, iconURL: message.user.displayAvatarURL() })
				.setDescription(message.description)
				.addFields(message.fields)
				.setThumbnail(
					message.attachments
						? "attachment://" + message.attachments[0].name
						: postHandleableInteraction.guild?.iconURL({ extension: "gif" }) ?? null
				)
				.setTimestamp();
			((postHandleableInteraction.member as GuildMember).guild.channels.resolve(message.channel) as TextChannel)
				.send({
					embeds: [embed],
					files: message.attachments,
				})
				.catch(() => console.error("Error al registrar log"));
		}
	});
};
