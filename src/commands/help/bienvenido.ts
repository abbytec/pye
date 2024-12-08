import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { sendWelcomeMessageProcessor } from "../../utils/welcome.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "📜 - Ayuda",

	data: new SlashCommandBuilder().setName("bienvenido").setDescription("Envía un mensaje de bienvenida a los nuevos usuarios."),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("bienvenido", 6e5)],
		async (interaction: IPrefixChatInputCommand): Promise<void> => {
			interaction.reply("Dando una calurosa bienvenida");
			await sendWelcomeMessageProcessor(interaction.client, false);
		}
	),
} as Command;
