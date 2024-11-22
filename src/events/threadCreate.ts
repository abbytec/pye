import { Events, ChannelType, EmbedBuilder, ThreadChannel, TextChannel, MessageFlags } from "discord.js";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import loadEnvVariables from "../utils/environment.ts";
import { COLORS, getChannel, getChannelFromEnv, getForumTopic, getHelpForumsIdsFromEnv } from "../utils/constants.ts";
import { addRep } from "../commands/rep/add-rep.ts";

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
		const prompt = `el contexto es: "${tittle}" (tema: ${getForumTopic(
			m.parentId ?? ""
		)}) si no lo entiendes no le des importancia. el prompt es: \n "${pregunta}" intenta resolver y ayudar con el prompt de manera clara y simple`.toString();
		const result = await model.generateContent(prompt);

		const response = result.response.text();
		m.send(
			`hola <@${m.ownerId}> \n\n ${response} \n\n **Fue útil mi respuesta? 🦾👀 |  Recuerda que de todos modos puedes esperar que otros usuarios te ayuden!** 😉`
		);
	} catch (error) {
		console.log(error);
	}
};
async function sendTagReminder(thread: ThreadChannel) {
	try {
		const owner = await thread.fetchOwner();
		if (owner) {
			const embed = new EmbedBuilder()
				.setDescription(
					`¡Hola! Vi que tu post no tiene etiquetas. Puedes obtener una respuesta más rápida teniendo algunas.\nAprende como usarlas [Ir allí...](https://discord.com/channels/768278151435386900/1309363726553448459/1309363726553448459) 😊`
				)
				.setColor(COLORS.pyeLightBlue);

			await thread.send({ embeds: [embed] });
		}
	} catch (error) {
		console.error(`Error al enviar mensaje de recordatorio en el hilo "${thread.name}":`, error);
	}
}
const spamPattern = new RegExp(
	"(?:discord[\\s/.,-]*(?:gg|li|me|io|com/invite)[/\\\\]?[a-z0-9-.]*|" +
		"discord[.,]?gg|" +
		"\\.gg|" +
		"steamcommunity|" +
		"nitro|" +
		"free discord|" +
		"gift|" +
		"robux|" +
		"giveaway|" +
		"https?:\\/\\/(?:[a-z0-9-.]+\\.)?(?:gift|steamcommunity|nitro|robux))",
	"i"
);

export default {
	name: Events.ThreadCreate,
	execute: async function (thread: ThreadChannel) {
		if (
			spamPattern.test(thread.name) ||
			thread.name.includes("discord.gg") ||
			thread.name.includes("discord,gg") ||
			thread.name.includes(".gg")
		)
			return thread.delete("spam detectado");
		if (thread.parent?.type == ChannelType.GuildForum && getHelpForumsIdsFromEnv().includes(thread.parent.id)) {
			try {
				const canal = (await getChannel(thread.guild, "chatProgramadores", true)) as TextChannel;
				if (!canal) return console.error('No se pudo encontrar el canal "chatProgramadores".');

				const guild = await thread.guild.fetch();

				const newField = {
					name: `:large_blue_diamond: <${(await thread.fetchOwner())?.user?.username}> necesita tu ayuda en **${thread.parent.name}**`,
					value: `> Su problema : <#${thread.id}>`,
				};

				const fetchedMessages = await canal.messages.fetch({ limit: 2 });

				const targetEmbedMessage = fetchedMessages.find(
					(msg) => msg.embeds.length > 0 && msg.embeds[0].title === "Nueva publicación 🌟"
				);

				if (targetEmbedMessage) {
					const existingEmbed = EmbedBuilder.from(targetEmbedMessage.embeds[0]);

					existingEmbed.addFields(newField);

					await targetEmbedMessage.edit({
						embeds: [existingEmbed],
					});
				} else {
					const newEmbed = new EmbedBuilder()
						.setColor(COLORS.pyeLightBlue)
						.setTitle("Nueva publicación 🌟")
						.addFields(newField)
						.setFooter({
							text: "¡Ayúdalo para ganar puntos y subir de rango!",
							iconURL: "https://cdn.discordapp.com/attachments/1115058778736431104/1281037481755807774/Mesa_de_trabajo_2_5-8.png",
						})
						.setTimestamp();

					const guildIconURL = guild.iconURL({ extension: "gif" });
					if (guildIconURL) {
						newEmbed.setThumbnail(guildIconURL);
					}

					await canal.send({
						embeds: [newEmbed],
					});
				}
			} catch (error) {
				console.error("Error al enviar o actualizar el embed de publicación:", error);
			}

			if (thread.appliedTags.length === 0) {
				await sendTagReminder(thread);
			}

			// GEMINI Api para responder threads.
			thread.fetchStarterMessage().then(async (msg) => {
				thread.sendTyping();
				await threadsHelp(thread.name, msg?.content ?? "", thread).catch((err) => {
					console.log(err);
				});
			});
		} else if (thread.parent?.id == getChannelFromEnv("retos")) {
			let owner = await thread.fetchOwner().catch(() => null);
			await addRep(owner?.user ?? null, thread.guild).then(async ({ member }) =>
				(thread.guild.channels.resolve(getChannelFromEnv("logPuntos")) as TextChannel | null)?.send(
					`${member.user.username} ha obtenido 1 punto porque creó un reto: ${thread.url}`
				)
			);
		}
	},
};
