import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { StarBoard } from "../../Models/StarBoard.ts";
import { Command } from "../../types/command.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";

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
		async (interaction: ChatInputCommandInteraction) => {
			const channel = interaction.options.getChannel("canal", true);
			const stars = interaction.options.getInteger("estrellas", true);

			await StarBoard.updateOne({ id: interaction.client.user?.id }, { channel: channel.id, stars: stars }, { upsert: true });

			await replyOk(interaction, `Se ha establecido el canal ${channel.name}\nTotal de reacciones requeridas: \`${stars}\` .`);
		},
		[]
	),
} as Command;
