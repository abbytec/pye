import { Events, ChannelType, EmbedBuilder, ThreadChannel, TextChannel, Message, DiscordAPIError } from "discord.js";
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
import { spamFilter } from "../security/spamFilter.js";
import { getFirstValidAttachment } from "../utils/generic.js";
import { createForumEmbed, generateForumResponse, sendLongReply } from "../utils/ai/aiResponseService.js";

export default {
	name: Events.ThreadCreate,
	execute: async function (thread: ThreadChannel) {
		let member = await thread.guild.members.fetch(thread.ownerId ?? "").catch(() => null);
		if (
			(await spamFilter(
				member,
				thread.client as ExtendedClient,
				{ channel: thread.parent, delete: thread.delete, id: thread.id, guild: thread.guild, url: thread.url },
				thread.name
			)) ||
			thread.ownerId == process.env.CLIENT_ID
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

const threadsHelp = async function (tittle: string, starterMessage: Message | null, m: ThreadChannel) {
	try {
		const prompt = `el contexto es: "${tittle}" (tema: ${getForumTopic(
			m.parentId ?? ""
		)}) si no lo entiendes no le des importancia. el prompt es: \n "${
			starterMessage?.content ?? ""
		}" intenta resolver y ayudar con el prompt de manera clara y simple`.toString();

		const authorName = (await m.guild.members.fetch(m.ownerId).catch(() => undefined))?.displayName ?? "Usuario";

		if (starterMessage) {
			const attachmentData = await getFirstValidAttachment(starterMessage.attachments).catch(async (e) => {
				starterMessage.reply(e.message);
				return undefined;
			});
			const fullMessage = await generateForumResponse(prompt, m.name, getForumTopic(m.parentId ?? ""), attachmentData);

			let embed = createForumEmbed(fullMessage, authorName);
			await sendLongReply(starterMessage, embed, fullMessage);
		} else {
			const fullMessage = await generateForumResponse(prompt, m.name, getForumTopic(m.parentId ?? ""));
			let embed = createForumEmbed(fullMessage, authorName);
			await sendLongReply(m, embed, fullMessage);
		}
	} catch (err: any) {
		if (!(err instanceof DiscordAPIError && err.message == "Unknown message")) {
			ExtendedClient.logError("Error al generar la respuesta de IA en foro:" + err.message, err.stack);
		}
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

		const fetchedMessages = await canal.messages.fetch({ limit: 2 }).catch(() => undefined);

		const targetEmbedMessage = fetchedMessages?.find((msg) => msg.embeds.length > 0 && msg.embeds[0].title === "Nueva publicación 🌟");

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
	thread.sendTyping();
	setTimeout(() => {
		thread
			.fetchStarterMessage()
			.then(async (msg) => await threadsHelp(thread.name, msg, thread).catch(console.error))
			.catch((err) => {
				console.error("Error al obtener el mensaje de inicio del hilo:", err);
			});
	}, 500);
	(thread.client as ExtendedClient).services.trending.add("threadPost", thread.parentId ?? "");
}
