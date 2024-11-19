import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { ExtendedClient } from "../../client.ts";
import { sendWelcomeMessageProcessor } from "../../utils/welcome.ts";

export default {
	group: "📜 - Ayuda",

	data: new SlashCommandBuilder().setName("bienvenido").setDescription("Envía un mensaje de bienvenida a los nuevos usuarios."),

	execute: composeMiddlewares([verifyIsGuild(process.env.GUILD_ID ?? "")], async (interaction: ChatInputCommandInteraction): Promise<void> => {
		await sendWelcomeMessageProcessor(interaction.client as ExtendedClient);
	}),
};
