import { AuditLogEvent, EmbedBuilder, Events, Message, PartialMessage, TextChannel } from "discord.js";
import { COLORS, getChannelFromEnv } from "../utils/constants.js";
import { ExtendedClient } from "../client.js";
import { messageGuard } from "../security/messageGuard.js";

export default {
	name: Events.MessageUpdate,
	once: false,
	async execute(oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) {
		if (!newMessage.guild) return;

		if (oldMessage.partial) {
			try {
				await oldMessage.fetch();
			} catch {}
		}
		if (newMessage.partial) {
			try {
				await newMessage.fetch();
			} catch {}
		}

		const client = newMessage.client as ExtendedClient;
		if (await messageGuard(newMessage as Message<true>, client)) return;

		const author = newMessage.author ?? (oldMessage as Message).author;
		if (!author || author.bot) return;

		const logChannel = newMessage.guild.channels.resolve(getChannelFromEnv("logMessages")) as TextChannel | null;
		if (!logChannel) return;

		const before = oldMessage.content?.slice(0, 300) || "—";
		const after = newMessage.content?.slice(0, 300) || "—";

		const embed = new EmbedBuilder()
			.setColor(COLORS.pyeLightBlue)
			.setAuthor({ name: `${author.tag}`, iconURL: author.displayAvatarURL() })
			.setDescription(`[Mensaje editado](${newMessage.url}) en <#${newMessage.channelId}>`)
			.addFields({ name: "Antes", value: `\`\`\`\n${before}\n\`\`\`` }, { name: "Después", value: `\`\`\`\n${after}\n\`\`\`` })
			.setTimestamp();

		logChannel.send({ embeds: [embed] }).catch(() => console.error("No se pudo enviar el log de mensajes"));
	},
};
