import { SlashCommandBuilder } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { sendWelcomeMessageProcessor } from "../../utils/welcome.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { ExtendedClient } from "../../client.js";

export default {
        group: "📜 - Ayuda",

	data: new SlashCommandBuilder().setName("bienvenido").setDescription("Envía un mensaje de bienvenida a los nuevos usuarios."),

        execute: composeMiddlewares(
                [verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("bienvenido", 6e5)],
                async (interaction: IPrefixChatInputCommand): Promise<void> => {
                        interaction.reply("Dando una calurosa bienvenida");
                        await sendWelcomeMessageProcessor(interaction.client, false, interaction.channelId);
                }
        ),
        prefixResolver: (client: ExtendedClient) => new PrefixChatInputCommand(client, "bienvenido", []),
} as Command;
