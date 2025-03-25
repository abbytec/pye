import { SlashCommandBuilder } from "discord.js";
import loadEnvVariables from "../../utils/environment.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { createChatEmbed, generateChatResponseStream } from "../../utils/ai/aiResponseService.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { getRecursiveRepliedContext } from "../../utils/ai/getRecursiveRepliedContext.js";
import { aiSecurityConstraint } from "../../utils/ai/gemini.js";

loadEnvVariables();

export default {
	data: new SlashCommandBuilder()
		.setName("pyechan")
		.setDescription("Preguntale algo complejo a PyE Chan para que razone")
		.addStringOption((option) => option.setName("mensaje").setDescription("Qué quieres decirme").setRequired(true).setMaxLength(200)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false), verifyCooldown("pyechan", 1000)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const mensajeInput = interaction.options.getString("mensaje", true) ?? "";
			let contextForAI: string;
			if (interaction.message) {
				contextForAI = await getRecursiveRepliedContext(interaction.message, true, 10, mensajeInput);
			} else {
				contextForAI = mensajeInput + aiSecurityConstraint;
			}

			const resultText = (await generateChatResponseStream(contextForAI, interaction.user.id)).text;

			await interaction.editReply({ embeds: [createChatEmbed(resultText)] }).catch(null);
		}
	),
	prefixResolver: (client: ExtendedClient) => {
		return new PrefixChatInputCommand(
			client,
			"pyechan",
			[
				{
					name: "mensaje",
					required: true,
					infinite: true,
				},
			],
			["pye", "iask"]
		);
	},
} as Command;
