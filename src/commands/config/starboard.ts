import { PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { StarBoard } from "../../Models/StarBoard.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

// Export command
export default {
	group: "⚙️ - Administración - General",
	data: new SlashCommandBuilder()
		.setName("starboard")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.setDescription("Establece el canal del starboard y las estrellas necesarias.")
		.addChannelOption((option) =>
			option.setName("canal").setDescription("Canal de texto donde se enviarán los mensajes de starboard").setRequired(true)
		)
		.addIntegerOption((option) =>
			option.setName("estrellas").setDescription("La cantidad de estrellas mínimo para mostrar").setRequired(true)
		),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const channel = await interaction.options.getChannel("canal", true);
			const stars = interaction.options.getInteger("estrellas", true);

			await StarBoard.updateOne({ id: process.env.GUILD_ID }, { channel: channel.id, stars: stars }, { upsert: true });

			await replyOk(
				interaction,
				`Se ha establecido el canal ${(channel as TextChannel).name}\nTotal de reacciones requeridas: \`${stars}\` .`
			);
		},
		[]
	),
} as Command;
