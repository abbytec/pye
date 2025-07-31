import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";
import loadEnvVariables from "../../utils/environment.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { createChatEmbed, createImageEmbed, generateImageResponse } from "../../utils/ai/aiResponseService.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import fs from "fs";

loadEnvVariables();

export default {
	group: "🤖 - Inteligencia Artificial",
	data: new SlashCommandBuilder()
		.setName("pyechan-img")
		.setDescription("Pídeme que genere una imagen")
		.addStringOption((option) => option.setName("mensaje").setDescription("Qué quieres decirme").setRequired(true).setMaxLength(200)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false), verifyCooldown("pyechan", 1000)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const mensajeInput = interaction.options.getString("mensaje", true) ?? "";

			const response = await generateImageResponse("Dibuja una imagen de " + mensajeInput, interaction.user.id);
			if (response.image) {
				const fileName = `generated_image${Date.now()}.png`;
				fs.writeFileSync(fileName, new Uint8Array(response.image));
				const attachment = new AttachmentBuilder(fileName, { name: fileName });
				await interaction
					.editReply({ embeds: [createImageEmbed(`attachment://${fileName}`)], files: [attachment] })
					.catch(null)
					.finally(() => {
						fs.unlinkSync(fileName);
					});
			} else {
				await interaction.editReply({ embeds: [createChatEmbed(response.text)] }).catch(null);
			}
		}
	),
	prefixResolver: (client: ExtendedClient) => {
		return new PrefixChatInputCommand(
			client,
			"pyechan-img",
			[
				{
					name: "mensaje",
					required: true,
					infinite: true,
				},
			],
			["pye-imagen", "pyeimg", "pye-img", "imagine"]
		);
	},
} as Command;
