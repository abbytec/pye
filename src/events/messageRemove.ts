import { Events, Message } from "discord.js";

import { getChannelFromEnv } from "../utils/constants.ts";
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
			].includes(message.channelId)
		)
			return;

		// Si el mensaje tiene hilos asociados, eliminarlos.
		if (message.hasThread) {
			try {
				const thread = message.thread;
				await thread?.delete().then(() => console.log(`Hilo ${thread?.name} eliminado porque su mensaje principal fue borrado.`));
			} catch (error) {
				console.error(`Error al eliminar el hilo asociado al mensaje: ${error}`);
			}
		}
	},
};
