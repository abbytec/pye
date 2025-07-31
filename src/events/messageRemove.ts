import { AttachmentBuilder, AuditLogEvent, EmbedBuilder, Events, Message, PartialMessage, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.js";
import { checkCredentialLeak } from "../security/credentialLeakFilter.js";

import { COLORS, getChannelFromEnv } from "../utils/constants.js";
import { saveTranscript } from "../utils/generic.js";

import fs from "fs";

export default {
	name: Events.MessageDelete,
	once: false,
        async execute(message: Message | PartialMessage) {
                if (!message.guild) return;

                if (message.partial) {
                        try {
                                await message.fetch();
                        } catch {
                                return;
                        }
                }

                const hasLeak = await checkCredentialLeak(
                        message as Message<true>,
                        message.client as ExtendedClient,
                );
                if (hasLeak) return;

		const logChannel = message.guild.channels.resolve(getChannelFromEnv("logMessages")) as TextChannel | null;
		const author = (message as Message).author;

		if (logChannel && author) {
			const embed = new EmbedBuilder()
				.setColor(COLORS.errRed)
				.setAuthor({
					name: `${author.tag}`,
					iconURL: author.displayAvatarURL(),
				})
				.setDescription(`Mensaje eliminado en <#${message.channelId}>`)
				.addFields({
					name: "Contenido",
					value: message.content ? `\`\`\`\n${message.content.slice(0, 300)}\n\`\`\`` : "—",
				})
				.setTimestamp();

			try {
				const fetched = await message.guild.fetchAuditLogs({
					type: AuditLogEvent.MessageDelete,
					limit: 1,
				});
				const deletionLog = fetched.entries.first();
				if (deletionLog) {
					const { executor, target, extra, createdTimestamp } = deletionLog;
					const sameChannel =
						extra && typeof extra === "object" && "channel" in extra && (extra as any).channel.id === message.channelId;
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
		}

		if (
			![
				getChannelFromEnv("recursos"),
				getChannelFromEnv("ofreceServicios"),
				getChannelFromEnv("proyectosNoPagos"),
				getChannelFromEnv("ofertasDeEmpleos"),
				getChannelFromEnv("linkedin"),
				getChannelFromEnv("gruposDeEstudio"),
			].includes(message.channelId)
		)
			return;

		// Si el mensaje tiene hilos asociados, eliminarlos.
		if (message.hasThread) {
			try {
				const thread = message.thread;
				if (!thread) return;
				try {
					const filePath = await saveTranscript(thread, "Transcripción del hilo");
					if (!fs.existsSync(filePath)) {
						throw new Error("Archivo no encontrado");
					}
					const attachment = new AttachmentBuilder(filePath);
					await (message.guild.channels.resolve(getChannelFromEnv("logMessages")) as TextChannel)
						?.send({
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
	},
};
