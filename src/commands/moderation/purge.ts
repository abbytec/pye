import { SlashCommandBuilder, PermissionFlagsBits, TextChannel } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("purge")
		.setDescription("Elimina mensajes recientes.")
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addIntegerOption((opt) =>
			opt.setName("cantidad").setDescription("Cantidad de mensajes a eliminar (1-100)").setRequired(true).setMinValue(1).setMaxValue(100)
		),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const amount = interaction.options.getInteger("cantidad", true);

			if (!interaction.guild) return;
			if (!interaction.channel?.isTextBased()) return await replyError(interaction, "Este comando solo puede usarse en canales de texto.");
			const ch = interaction.channel as TextChannel;
			const deleted = await ch.bulkDelete(amount, true).catch(() => null);
			if (!deleted) return await replyError(interaction, "No se pudieron eliminar los mensajes.");
			return await replyOk(interaction, `Se eliminaron ${deleted.size} mensajes.`, undefined, undefined, undefined, undefined, true);
		}
	),
	prefixResolver: (client: ExtendedClient) => new PrefixChatInputCommand(client, "purge", [{ name: "cantidad", required: true }], []),
} as Command;
