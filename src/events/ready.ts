import { Events } from "discord.js";
import { ExtendedClient } from "../client.js";
import { sendWelcomeMessageProcessor } from "../utils/welcome.js";

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client: ExtendedClient) {
		console.log(`Bot Listo como: ${client.user?.tag} ! `);
		await client.updateClientData(true);

		try {
			const invites = await ExtendedClient.guild?.invites.fetch();
			invites?.forEach((inv) => client.invites.set(inv.code, inv.uses ?? 0));
		} catch (error) {
			console.error("Error al obtener las invitaciones:", error);
		}
		
		if (process.env.ENABLE_AUTO_WELCOME_MESSAGE)
			setInterval(async () => {
				sendWelcomeMessageProcessor(client);
			}, 36e5);
	},
};
