import { Guild, SlashCommandBuilder } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { replyError } from "../../utils/messages/replyError.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";

export default {
	data: new SlashCommandBuilder()
		.setName("send-sticker")
		.setDescription("Envía un sticker específico al canal actual.")
		.addStringOption((option) => option.setName("stickerid").setDescription("ID del sticker de la guild").setRequired(true)),
	execute: composeMiddlewares([verifyIsGuild(process.env.GUILD_ID ?? "")], async (interaction: IPrefixChatInputCommand) => {
		const stickerId = interaction.options.getString("stickerid", true);
		const guild = interaction.guild as Guild;
		const channel = interaction.channel;
		const sticker = await guild.stickers.fetch(stickerId).catch(() => undefined);
		if (!sticker) return await replyError(interaction, "No se pudo encontrar el sticker.");

		if (channel && "send" in channel) {
			await channel.send({ stickers: [sticker], content: interaction.user.tag + "> **" + sticker.name + "**" }).catch(() => undefined);
		}
	}),
} as Command;
