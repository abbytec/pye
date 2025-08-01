import { SlashCommandBuilder } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { replyError } from "../../utils/messages/replyError.js";
import ms from "ms";
import { replyOk } from "../../utils/messages/replyOk.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { ExtendedClient } from "../../client.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	data: new SlashCommandBuilder()
		.setName("reminder")
		.setDescription("Recibe un aviso personalizado")
		.addStringOption((option) =>
			option.setName("mensaje").setDescription("Pon tu mensaje de recordatorio").setRequired(true).setMaxLength(200)
		)
		.addStringOption((option) =>
			option.setName("tiempo").setDescription("Cantidad de tiempo para recordarte (10min, 1h. Max 24h)").setRequired(true).setMaxLength(10)
		),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const message = interaction.options.getString("mensaje", true);
			const time = interaction.options.getString("tiempo", true);
			const timems = ms(time);
			if (timems < 60e3 || timems > 86.4e6) return replyError(interaction, "Tiempo invállido. El máximo es 24h y el mínimo 1min.");
			// Castear duración y setear el tiempo
			const reminderTime = new Date(Date.now() + timems);

			// Check the current time every second
			try {
				await ExtendedClient.agenda.schedule(reminderTime, "send reminder", {
					username: interaction.user.username,
					message: message,
					channelId: interaction.channelId,
				});
				return replyOk(interaction, "Se creó tu recordatorio.");
			} catch (error) {
				console.error("Error al programar el recordatorio:", error);
				return replyError(interaction, "Hubo un error al crear tu recordatorio.");
			}
		}
	),
} as Command;
