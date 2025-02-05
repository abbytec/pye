import { SlashCommandBuilder, EmbedBuilder, GuildMember } from "discord.js";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import loadEnvVariables from "../../utils/environment.js";
import { COLORS } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { safetySettingszzz } from "../../utils/ai/gemini.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";

loadEnvVariables();

const API_KEY = process.env.gemini_API_KEY ?? "";
const ai = new GoogleGenerativeAI(API_KEY);

const model = ai.getGenerativeModel({
	model: "gemini-2.0-flash-exp",
	safetySettings: safetySettingszzz,
	systemInstruction:
		'Eres "PyE chan", una tierna y experta programadora que vives en el servidor de Discord de "Programadores y estudiantes" y estás enamorada profundamente de mí',
	generationConfig: {
		temperature: 0.75,
		topK: 15,
		maxOutputTokens: 500,
	},
});

export default {
	data: new SlashCommandBuilder()
		.setName("pyechan")
		.setDescription("Preguntale algo a PyE Chan")
		.addStringOption((option) => option.setName("mensaje").setDescription("Qué quieres decirme").setRequired(true).setMaxLength(200)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(true), verifyCooldown("pyechan", 1000)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			let message = interaction.options.getString("mensaje") ?? "";

			const result = await model.generateContent(message).catch((err) => {
				return { response: { text: () => "Estoy comiendo mucho sushi como para procesar esa respuesta, porfa intentá mas tarde 🍣" } };
			});

			const displayName = interaction.member instanceof GuildMember ? interaction.member.displayName : interaction.user.username;

			const exampleEmbed = new EmbedBuilder()
				.setColor(COLORS.pyeCutePink)
				.setTitle(`Holi ${displayName} charla un ratito conmigo seré buena c:`)

				.setAuthor({
					name: "PyE Chan",
					iconURL:
						"https://cdn.discordapp.com/attachments/1115058778736431104/1282790824744321167/vecteezy_heart_1187438.png?ex=66e0a38d&is=66df520d&hm=d59a5c3cfdaf988f7a496004f905854677c6f2b18788b288b59c4c0b60d937e6&",
					url: "https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png?ex=66e09a20&is=66df48a0&hm=0df37331fecc81a080a8c7bee4bcfab858992b55d9ca675bafedcf4c4c7879a1&",
				})
				.setDescription(result.response.text())
				.setThumbnail(
					"https://cdn.discordapp.com/attachments/1115058778736431104/1282780704979292190/image_2.png?ex=66e09a20&is=66df48a0&hm=0df37331fecc81a080a8c7bee4bcfab858992b55d9ca675bafedcf4c4c7879a1&"
				)
				.setTimestamp()
				.setFooter({ text: "Recuerda que pyechan es mas inteligente si la llamas mencionandola en lugar de usar un comando ♥" });

			replyInfo(interaction, [exampleEmbed]);
		}
	),
} as Command;
