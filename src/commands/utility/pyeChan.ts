import { SlashCommandBuilder, EmbedBuilder, GuildMember, Message } from "discord.js";
import loadEnvVariables from "../../utils/environment.js";
import { COLORS } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { generateChatResponse } from "../../utils/ai/aiResponseService.js";
import { modelPyeChanReasoningAnswer } from "../../utils/ai/gemini.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { getRecursiveRepliedContext } from "../../utils/ai/getRecursiveRepliedContext.js";

loadEnvVariables();

export default {
	data: new SlashCommandBuilder()
		.setName("pyechan")
		.setDescription("Preguntale algo complejo a PyE Chan")
		.addStringOption((option) => option.setName("mensaje").setDescription("Qué quieres decirme").setRequired(true).setMaxLength(200)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(true), verifyCooldown("pyechan", 1000)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const mensajeInput = interaction.options.getString("mensaje") ?? "";

			let contextForAI: string;
			if (interaction.message) {
				contextForAI = await getRecursiveRepliedContext(interaction.message, true, 10, mensajeInput);
			} else {
				contextForAI = mensajeInput;
			}

			const resultText = await generateChatResponse(contextForAI, interaction.user.id, modelPyeChanReasoningAnswer);

			const displayName = interaction.member instanceof GuildMember ? interaction.member.displayName : interaction.user.username;

			const exampleEmbed = new EmbedBuilder()
				.setColor(COLORS.pyeCutePink)
				.setTitle(`Holi ${displayName} charla un ratito conmigo seré buena c:`)
				.setAuthor({
					name: "PyE Chan",
					iconURL: "https://cdn.discordapp.com/attachments/1115058778736431104/1282790824744321167/vecteezy_heart_1187438.png",
					url: "https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png",
				})
				.setDescription(resultText)
				.setThumbnail("https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png")
				.setTimestamp()
				.setFooter({ text: "Recuerda que pyechan es más inteligente si la llamas mencionándola en lugar de usar un comando ♥" });

			await replyInfo(interaction, [exampleEmbed]);
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
				},
			],
			["pye", "reason"]
		);
	},
} as Command;
