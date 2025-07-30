import { Guild, SlashCommandBuilder, TextChannel } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { replyError } from "../../utils/messages/replyError.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { replyOk } from "../../utils/messages/replyOk.js";

export default {
	data: new SlashCommandBuilder()
		.setName("send-sticker")
		.setDescription("Envía un sticker específico al canal actual.")
		.addStringOption((option) => option.setName("stickerid").setDescription("ID del sticker de la guild").setRequired(true)),
	execute: composeMiddlewares([verifyIsGuild(process.env.GUILD_ID ?? "")], async (interaction: IPrefixChatInputCommand) => {
		const channel = interaction.channel as TextChannel | undefined;
		if (!channel) return await replyError(interaction, "No se pudo encontrar el canal de texto.");
		channel.sendTyping();
		const stickerId = interaction.options.getString("stickerid", true);
		const guild = interaction.guild as Guild;

		const sticker = await guild.stickers.fetch(stickerId).catch(() => undefined);
		if (!sticker) return await replyError(interaction, "No se pudo encontrar el sticker.");
		await replyOk(interaction, `${interaction.user.tag} > **${sticker.name}**"`);
		await channel.send({ stickers: [sticker], content: "" }).catch(() => undefined);
	}),
} as Command;
