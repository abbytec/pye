import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder, TextChannel } from "discord.js";
import { StarBoard } from "../../Models/StarBoard.js";
import { Command } from "../../types/command.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";

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

			await StarBoard.updateOne({ id: process.env.GUILD_ID }, { channel: channel.id, stars: stars }, { upsert: true });

			await replyOk(interaction, `Se ha establecido el canal ${channel.name}\nTotal de reacciones requeridas: \`${stars}\` .`);
		},
		[]
	),
} as Command;
