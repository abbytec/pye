import { AttachmentBuilder, EmbedBuilder, Events, Message, TextChannel } from "discord.js";

import { COLORS, getChannelFromEnv } from "../utils/constants.js";
import { saveTranscript } from "../utils/generic.js";

import fs from "fs";

export default {
	name: Events.MessageDelete,
	once: false,
	async execute(message: Message) {
		if (!message.guild) return;
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
					await (message.guild.channels.cache.get(getChannelFromEnv("logMessages")) as TextChannel)
						?.send({
							embeds: [
								new EmbedBuilder()
									.setTitle(`El usuario ${message.author.username} eliminó su hilo. Guardada la transcripción`)
									.setDescription(`Canal: <#${thread.parent?.id}>`)
									.setColor(COLORS.pyeLightBlue)
									.setTimestamp(),
							],
							files: [attachment],
						})
						.then(
							async () =>
								await thread
									.delete()
									.then(() => console.log(`Hilo ${thread?.name} eliminado porque su mensaje principal fue borrado.`))
						)
						.catch(null)
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
