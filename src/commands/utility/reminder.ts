import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
} from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import ms from "ms";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import {getChannelFromEnv } from "../../utils/constants.ts";

export default {
    data: new SlashCommandBuilder()
        .setName("reminder")
        .setDescription("Recibe un aviso personalizado")
        .addStringOption((option) =>
            option
                .setName("mensaje")
                .setDescription("Pon tu mensaje de recordatorio")
                .setRequired(true)
                .setMaxLength(200)
        )
        .addStringOption((option) =>
            option
                .setName("tiempo")
                .setDescription(
                    "Cantidad de tiempo para recordarte (10min, 1h. Max 24h)"
                )
                .setRequired(true)
                .setMaxLength(10)
        ),
    execute: composeMiddlewares(
        [verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("general")), deferInteraction],
        async (interaction: ChatInputCommandInteraction) => {
            const message = interaction.options.getString("mensaje", true);
            const time = interaction.options.getString("tiempo", true);
            const timems = ms(time);
            if (timems < 60e3 || timems > 86.4e6)
                replyError(interaction, "Tiempo invállido. El máximo es 24h y el mínimo 1min.");
            // Castear duración y setear el tiempo
            const reminderTime = Date.now() + timems;

            console.log(
                `Se añadió un recordatorio ${new Date(reminderTime).toLocaleString()}`
            );

            // Check the current time every second
            const intervalId = setInterval(async () => {
                const currentTime = Date.now();
                if (currentTime >= reminderTime) {
                    clearInterval(intervalId);
                    // Send reminder to the user or channel
                    await replyOk(interaction, `${message}`);
                }
            }, 60e3); // Check every second
        }
    )
}