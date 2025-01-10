import { Events, ChannelType, EmbedBuilder, ThreadChannel, TextChannel, Message } from "discord.js";
import {
	COLORS,
	getChannel,
	getChannelFromEnv,
	getForumTopic,
	getHelpForumsIdsFromEnv,
	threadForumProcessingLimiter,
} from "../utils/constants.js";
import { addRep } from "../commands/rep/add-rep.js";
import { ExtendedClient } from "../client.js";
import { spamFilter } from "../security/spamFilters.js";
import { geminiModel } from "../utils/ai/gemini.js";
import { splitMessage } from "../utils/generic.js";

export default {
	name: Events.ThreadCreate,
	execute: async function (thread: ThreadChannel) {
		let member = await thread.guild.members.fetch(thread.ownerId ?? "").catch(() => null);
		if (
			await spamFilter(
				member,
				thread.client as ExtendedClient,
				{ channel: thread.parent, delete: thread.delete, id: thread.id, guild: thread.guild, url: thread.url },
				thread.name
			)
		)
			return;
		if (thread.parent?.type == ChannelType.GuildForum && getHelpForumsIdsFromEnv().includes(thread.parent.id)) {
			threadForumProcessingLimiter.schedule(async () => await processHelpForumPost(thread));
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

const MAX_MESSAGE_LENGTH = 2000;
const threadsHelp = async function (tittle: string, pregunta: string, m: ThreadChannel) {
	try {
		const prompt = `el contexto es: "${tittle}" (tema: ${getForumTopic(
			m.parentId ?? ""
		)}) si no lo entiendes no le des importancia. el prompt es: \n "${pregunta}" intenta resolver y ayudar con el prompt de manera clara y simple`.toString();

		const result = await geminiModel.generateContent(prompt);
		const response = result.response.text();

		const fullMessage = `hola <@${m.ownerId}> \n\n ${response} \n\n **Fue útil mi respuesta? 🦾👀 | Recuerda que de todos modos puedes esperar que otros usuarios te ayuden!** 😉`;

		// Divide el mensaje si es necesario
		if (fullMessage.length <= MAX_MESSAGE_LENGTH) {
			await m.send(fullMessage);
		} else {
			const chunks = splitMessage(fullMessage, MAX_MESSAGE_LENGTH);
			let lastChunk: Message | undefined;
			for (const chunk of chunks) {
				if (lastChunk) {
					await lastChunk.reply(chunk);
				} else {
					await m.send(chunk).then((msg) => (lastChunk = msg));
				}
			}
		}
	} catch (error) {
		console.log(error);
	}
};

async function processHelpForumPost(thread: ThreadChannel) {
	try {
		const canal = (await getChannel(thread.guild, "chatProgramadores", true)) as TextChannel;
		if (!canal) return console.error('No se pudo encontrar el canal "chatProgramadores".');

		const guild = await thread.guild.fetch();

		const newField = {
			name: `:large_blue_diamond: Se necesita tu ayuda en **${thread.parent?.name}**`,
			value: `	 <#${thread.id}>`,
		};

		const fetchedMessages = await canal.messages.fetch({ limit: 2 });

		const targetEmbedMessage = fetchedMessages.find((msg) => msg.embeds.length > 0 && msg.embeds[0].title === "Nueva publicación 🌟");

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
	ExtendedClient.trending.add("threadPost", thread.parentId ?? "");
}
