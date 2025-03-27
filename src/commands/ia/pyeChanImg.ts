import { AttachmentBuilder, MessagePayload, MessageReplyOptions, SlashCommandBuilder } from "discord.js";
import loadEnvVariables from "../../utils/environment.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { createChatEmbed, createImageEmbed, generateImageResponse } from "../../utils/ai/aiResponseService.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { getRecursiveRepliedContext } from "../../utils/ai/getRecursiveRepliedContext.js";
import fs from "fs";

loadEnvVariables();

export default {
	data: new SlashCommandBuilder()
		.setName("pyechan-img")
		.setDescription("Habla con PyE Chan y responderá por imagen")
		.addStringOption((option) => option.setName("mensaje").setDescription("Qué quieres decirme").setRequired(true).setMaxLength(200)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false), verifyCooldown("pyechan", 1000)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const mensajeInput = interaction.options.getString("mensaje", true) ?? "";

			const response = await generateImageResponse("Dibuja una imagen de " + mensajeInput, interaction.user.id);
			if (response.image) {
				let fileName = `generated_image${Date.now()}.png`;
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
