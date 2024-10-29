import { Events, ChannelType, EmbedBuilder, ThreadChannel, TextChannel } from "discord.js";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import loadEnvVariables from "../utils/environment.ts";
import { getChannel } from "../utils/constants.ts";

loadEnvVariables();
const genAI = new GoogleGenerativeAI(process.env.gemini_API_KEY ?? "");
const generationConfigzzz = {
	temperature: 0.7,
	topK: 15,
	topP: 1,
};

const safetySettingszzz = [
	{
		category: HarmCategory.HARM_CATEGORY_HARASSMENT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
];

const model = genAI.getGenerativeModel({
	model: "gemini-1.5-flash",
	generationConfig: generationConfigzzz,
	safetySettings: safetySettingszzz,
	systemInstruction:
		"Eres alguien que ayuda a programadores con sus problemas y dudas a los demas, intenta resolver, ayudar y explicar en pocas palabras los problemas de codigo de los demas porgramadores de manera clara y simple.",
});

const threadsHelp = async function (tittle: string, pregunta: string, m: ThreadChannel) {
	try {
		const prompt =
			`el contexto es: "${tittle}" si no lo entiendes no le des importancia. el prompt es: \n "${pregunta}" intenta resolver y ayudar con el prompt de manera clara y simple`.toString();
		const result = await model.generateContent(prompt);

		const response = result.response.text();
		m.send(
			`hola <@${m.ownerId}> \n\n ${response} \n\n **Fue útil mi respuesta? 🦾👀 |  Recuerda que de todos modos puedes esperar que otros usuarios te ayuden!** 😉`
		);
	} catch (error) {
		console.log(error);
	}
};

export default {
	name: Events.ThreadCreate,
	execute: async function (thread: ThreadChannel) {
		if (thread.parent?.type == ChannelType.GuildForum) {
			//Enviar advertencia de nuevo thread.
			const canal = (await getChannel(thread.guild, "sugerencias", true)) as TextChannel;
			canal.send({
				embeds: [
					new EmbedBuilder()
						.setColor(0x0099ff)
						.setTitle("Nueva publicación 🌟")
						.setDescription(
							`
                      :large_blue_diamond: <@${thread.ownerId}> necesita tu ayuda en **${thread.parent}** 
                      > Su problema : <#${thread.id}>
                    `
						)
						.setFooter({
							text: "¡Ayúdalo para ganar puntos y subir de rango!",
							iconURL:
								"https://cdn.discordapp.com/attachments/1115058778736431104/1281037481755807774/Mesa_de_trabajo_2_5-8.png?ex=66da42a0&is=66d8f120&hm=6e2562a64fc6ca93ad9f69c9c9f48174938c4b9e8ca531b445c0b7099853b886&",
						}),
				],
			});

			// GEMINI Api para responder threads.
			thread.fetchStarterMessage().then(async (msg) => {
				thread.sendTyping();
				await threadsHelp(thread.name, msg?.content ?? "", thread).catch((err) => {
					console.log(err);
				});
			});
			// Enviar log al canal
		}
	},
};
