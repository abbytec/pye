import { AttachmentBuilder, AuditLogEvent, EmbedBuilder, Events, Message, PartialMessage, TextChannel, User } from "discord.js";
import { CoreClient } from "../../CoreClient.js";
import { IService } from "../../IService.js";
import { checkCredentialLeak } from "../../../security/credentialLeakFilter.js";
import { messageGuard } from "../../../security/messageGuard.js";
import { COLORS, getChannelFromEnv } from "../../../utils/constants.js";
import { saveTranscript } from "../../../utils/generic.js";
import { ExtendedClient } from "../../../client.js";
import fs from "fs";

export default class MessageWatcherService implements IService {
	public readonly serviceName = "messageWatcher";

	constructor(private readonly client: CoreClient) {}

	start() {
		this.client.on(Events.MessageDelete, (message: Message | PartialMessage) => this.onMessageChange(null, message));
		this.client.on(Events.MessageUpdate, (oldMessage: Message | PartialMessage, newMessage: Message | PartialMessage) =>
			this.onMessageChange(oldMessage, newMessage)
		);
	}

	private async resolveMessageContext(message: Message | PartialMessage): Promise<{
		message: Message<true>;
		author: User;
		logChannel: TextChannel;
	} | null> {
		if (!message.guild) return null;

		if (message.partial) {
			try {
				await message.fetch();
			} catch {
				return null;
			}
		}

		const fullMessage = message as Message<true>;
		const author = fullMessage.author;
		if (!author || author.bot) return null;

		const logChannel = fullMessage.guild.channels.resolve(getChannelFromEnv("logMessages")) as TextChannel | null;
		if (!logChannel) return null;

		return { message: fullMessage, author, logChannel };
	}

	private async onMessageChange(oldMessage: Message | PartialMessage | null, newMessage: Message | PartialMessage) {
		if (oldMessage?.partial) {
			try {
				await oldMessage.fetch();
			} catch {
				// Ignore
			}
		}

		const context = await this.resolveMessageContext(newMessage);
		if (!context) return;
		const { message: msg, author, logChannel } = context;

		if (!oldMessage) {
			const hasLeak = await checkCredentialLeak(msg, this.client as ExtendedClient);
			if (hasLeak) return;

			const embed = new EmbedBuilder()
				.setColor(COLORS.errRed)
				.setAuthor({
					name: `${author.tag}`,
					iconURL: author.displayAvatarURL(),
				})
				.setDescription(`Mensaje eliminado en <#${msg.channelId}>`)
				.addFields({
					name: "Contenido",
					value: msg.content ? `\`\`\`\n${msg.content.slice(0, 300)}\n\`\`\`` : "—",
				})
				.setTimestamp();

			try {
				const fetched = await msg.guild.fetchAuditLogs({
					type: AuditLogEvent.MessageDelete,
					limit: 1,
				});
				const deletionLog = fetched.entries.first();
				if (deletionLog) {
					const { executor, target, extra, createdTimestamp } = deletionLog;
					const sameChannel = extra && typeof extra === "object" && "channel" in extra && extra.channel.id === msg.channelId;
					if (executor && sameChannel && target?.id === author.id && Date.now() - createdTimestamp < 5000) {
						embed.addFields({
							name: "Eliminado por",
							value: `<@${executor.id}>`,
						});
					}
				}
			} catch (e) {
				console.error("Error obteniendo auditoría de borrado de mensaje:", e);
			}

			logChannel.send({ embeds: [embed] }).catch(() => console.error("No se pudo enviar el log de mensajes"));

			if (msg.hasThread) {
				try {
					const thread = msg.thread;
					if (!thread) return;
					try {
						const filePath = await saveTranscript(thread, "Transcripción del hilo");
						if (!fs.existsSync(filePath)) {
							throw new Error("Archivo no encontrado");
						}
						const attachment = new AttachmentBuilder(filePath);
						await logChannel
							.send({
								embeds: [
									new EmbedBuilder()
										.setTitle(`El usuario ${author.username} eliminó su hilo. Guardada la transcripción`)
										.setDescription(`Canal: <#${thread.parent?.id}>`)
										.setColor(COLORS.pyeLightBlue)
										.setTimestamp(),
								],
								files: [attachment],
							})
							.catch(() => console.error("No se pudo enviar el log de mensajes"))
							.then(
								async () =>
									await thread
										.delete()
										.then(() => console.log(`Hilo ${thread?.name} eliminado porque su mensaje principal fue borrado.`))
							)
							.catch(() => null)
							.finally(() => fs.unlinkSync(filePath));
					} catch (error) {
						console.error("Error al guardar la transcripción:", error);
					}
				} catch (error) {
					console.error(`Error al eliminar el hilo asociado al mensaje: ${error}`);
				}
			}
		} else {
			const client = this.client as ExtendedClient;
			if (await messageGuard(msg, client, true)) return;

			const before = oldMessage.content?.slice(0, 300) || "—";
			const after = msg.content?.slice(0, 300) || "—";

			const embed = new EmbedBuilder()
				.setColor(COLORS.pyeLightBlue)
				.setAuthor({ name: `${author.tag}`, iconURL: author.displayAvatarURL() })
				.setDescription(`[Mensaje editado](${msg.url}) en <#${msg.channelId}>`)
				.addFields({ name: "Antes", value: `\`\`\`\n${before}\n\`\`\`` }, { name: "Después", value: `\`\`\`\n${after}\n\`\`\`` })
				.setTimestamp();

			logChannel.send({ embeds: [embed] }).catch(() => console.error("No se pudo enviar el log de mensajes"));
		}
	}
}

