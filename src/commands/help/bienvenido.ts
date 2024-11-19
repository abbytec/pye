import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { ExtendedClient } from "../../client.ts";
import { sendWelcomeMessageProcessor } from "../../utils/welcome.ts";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.ts";

export default {
	group: "📜 - Ayuda",

	data: new SlashCommandBuilder().setName("bienvenido").setDescription("Envía un mensaje de bienvenida a los nuevos usuarios."),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("bienvenido", 6e5)],
		async (interaction: ChatInputCommandInteraction): Promise<void> => {
			await sendWelcomeMessageProcessor(interaction.client as ExtendedClient, false);
		}
	),
};
