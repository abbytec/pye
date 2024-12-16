// src/utils/checkHelp.ts

import { ActionRowBuilder, ButtonBuilder, AttachmentBuilder, ButtonStyle, Message, TextChannel, EmbedBuilder, APIEmbedField } from "discord.js";
import { COLORS, getChannelFromEnv, getRoleFromEnv } from "./constants.js";

/**
 * Normalize a string by converting it to lowercase, removing diacritics, apostrophes, and commas.
 *
 * @param input - The input string to process.
 * @returns The processed and normalized string.
 */
function normalizeString(input: string): string {
	return input
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.replace(/'/g, "")
		.replace(/,/g, "");
}

/**
 * Interface for the fetched messages and helpers.
 */
interface FetchResult {
	helpers: string[];
	messages: Message<boolean>[];
	repliedMessage: Message | null;
}

/**
 * Fetch the latest messages and the authors (helpers) of those messages.
 *
 * @param gratitudeMessage - The gratitude message that triggered the flow.
 * @returns An object containing messages and helpers.
 */
async function fetchMessagesAndHelpers(gratitudeMessage: Message): Promise<FetchResult> {
	const messagesFetched = await gratitudeMessage.channel.messages.fetch({
		limit: 10,
		before: gratitudeMessage.id,
	});

	let repliedMessage: Message | null = null;
	if (gratitudeMessage.reference?.messageId) {
		try {
			repliedMessage = await gratitudeMessage.channel.messages.fetch(gratitudeMessage.reference.messageId);
		} catch {
			// Si no se puede encontrar el mensaje referenciado, se ignora.
			repliedMessage = null;
		}
	}

	const messages = messagesFetched
		.filter((msg) => !msg.author.bot && !msg.system && msg.content)
		.sort((a, b) => a.createdTimestamp - b.createdTimestamp)
		.values();

	let helpers: string[] = [];
	let msges: Message[] = [];
	for (const msg of messages) {
		if (!helpers.includes(msg.author.id) && msg.author.id !== gratitudeMessage.author.id && !msg.author.bot) {
			helpers.push(msg.author.id);
			msges.push(msg);
		}
	}

	if (repliedMessage && repliedMessage.author.id !== gratitudeMessage.author.id) {
		helpers.unshift(repliedMessage.author.id);
	}

	helpers = Array.from(new Set(helpers)).slice(0, 4);
	return {
		helpers,
		messages: msges,
		repliedMessage,
	};
}

/**
 * Build fields for embed message.
 *
 * @param params - The parameters for building fields.
 * @returns An array of fields for the embed.
 */
interface BuildFieldsParams {
	gratitudeMessage: Message;
	messages: Message[];
	repliedMessage: Message | null;
	helpers: string[];
}

function buildFields({ gratitudeMessage, messages, repliedMessage, helpers }: BuildFieldsParams): { name: string; value: string }[] {
	const listOfComments = messages.map((msg, index) => ({
		name: `Comentario ${index + 1}`,
		value: `${msg.author} (\`${msg.author.id}\`)\n${msg.content.slice(0, 250)} [Ir allá](${msg.url})`,
	}));

	const divider = [{ name: " ════════════════════", value: "\u200b" }];

	const channelField = { name: "# Canal", value: `<#${gratitudeMessage.channel.id}>` };
	const userHelpedField = {
		name: "# Miembro Ayudado",
		value: `${gratitudeMessage.author} (\`${gratitudeMessage.author.id}\`)`,
	};

	const repliedText = repliedMessage
		? `> ${repliedMessage.author} (\`${repliedMessage.author.id}\`) : *${repliedMessage.content.slice(0, 180)}* [Ir allá](${
				repliedMessage.url
		  })`
		: "";

	const helpedMessage = `
${repliedText}
${repliedMessage ? "  :arrow_right_hook:" : ""} ${repliedMessage ? "**Miembro ayudado respondió** :" : ""} ${gratitudeMessage.content.slice(
		0,
		250
	)}... [Ir allá!](${gratitudeMessage.url})
`;

	const helpedMessageTrigger = {
		name: "# Mensaje de agradecimiento",
		value: helpedMessage,
	};

	const posibleHelpers = {
		name: "POSIBLES AYUDANTES",
		value: helpers
			.map(
				(id, i) =>
					`**${i + 1}**. (\`${id}\`) - ${gratitudeMessage.guild?.members.cache.get(id)?.toString() ?? "Miembro desconocido"} **${
						messages.filter((m) => m.author.id === id).length
					}** veces.`
			)
			.join("\n"),
	};

	const fields = [...listOfComments, ...divider, channelField, userHelpedField, helpedMessageTrigger];

	if (helpers.length > 0) {
		fields.push(divider[0]);
		fields.push(posibleHelpers);
	}

	return fields;
}

/**
 * Send an error report to a developer channel.
 *
 * @param client - The Discord client.
 * @param error - The error to report.
 * @param method - The method where the error occurred.
 * @param url - The URL or context where the error occurred.
 */
async function sendErrorReport(message: Message<boolean>, error: any, method: string, url: string): Promise<void> {
	const errorChannelId = getChannelFromEnv("logs");
	const staffRoleId = getRoleFromEnv("staff");

	const errorChannel = message.client.channels.resolve(errorChannelId) as TextChannel | null;
	if (!errorChannel) return;

	const errorMessage = process.env.NODE_ENV === "development" ? `<@${message.author.id}>` : `<@&${staffRoleId}>`;

	const attachment = new AttachmentBuilder(Buffer.from(`${error.stack}\nMétodo: ${method}\nURL: ${url}`), {
		name: "check.txt",
	});

	await errorChannel.send({
		content: errorMessage,
		files: [attachment],
	});
}

/**
 * Send a help notification to the points channel.
 *
 * @param msg - The message that triggered the help.
 * @param fields - The fields to include in the embed.
 * @param buttons - The buttons to include in the embed.
 */
async function sendHelpNotification(msg: Message, fields: APIEmbedField[], buttons: ButtonBuilder[]): Promise<void> {
	const pointsChannelId = getChannelFromEnv("notificaciones");
	const pointsChannel = (msg.client.channels.cache.get(pointsChannelId) ?? msg.client.channels.resolve(pointsChannelId)) as TextChannel | null;

	if (!pointsChannel) {
		throw new Error(`No se pudo encontrar el canal con ID ${pointsChannelId}`);
	}

	const embed = new EmbedBuilder()
		.setThumbnail(msg.guild?.iconURL() ?? null)
		.setTitle("Se ha encontrado una nueva ayuda!")
		.addFields(fields)
		.setTimestamp(new Date());

	const user = await msg.author.fetch();
	const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
	if ((user.createdAt?.getTime() ?? 0) > daysAgo(2).getTime()) {
		embed.setDescription(`\`\`\`ansi\n[35mEl miembro que agradeció (${msg.author.username})\nCreó su cuenta recientemente.\n\`\`\``);
		embed.setColor(COLORS.warnOrange);
	} else if ((msg.member?.joinedTimestamp ?? 0) > daysAgo(5).getTime()) {
		embed.setDescription(`\`\`\`ansi\n[32mEl miembro que agradeció (${msg.author.username})\nSe unió al servidor recientemente.\n\`\`\``);
		embed.setColor(COLORS.okGreen);
	} else embed.setColor(COLORS.pyeLightBlue);

	const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

	await pointsChannel.send({
		embeds: [embed],
		components: [actionRow],
	});
}

/**
 * Check if a message is a help message and process it accordingly.
 *
 * @param msg - The message to check.
 * @returns A boolean indicating if the message was a help message.
 */
export async function checkHelp(msg: Message): Promise<void> {
	const normalizedString = normalizeString(msg.content);
	const gratitudeKeywords = [
		"gracias",
		"thx",
		"thanks",
		"solucionado",
		"resuelto",
		"arreglado",
		"tenkiu",
		"arigato",
		"me ayudaste",
		"grax",
		"muy amable",
		"que amable",
		"funciono",
		"lo logre",
		"thank you",
	];

	const negativeKeywords = ["no funciono", "gracias de antemano"];

	// Verificar si el mensaje contiene alguna de las palabras de gratitud
	const containsGratitude = gratitudeKeywords.some((keyword) => normalizedString.includes(keyword));
	if (!containsGratitude) return;

	// Excluir ciertos mensajes que contienen palabras negativas
	const containsNegative = negativeKeywords.some((keyword) => normalizedString.includes(keyword));
	if (containsNegative) return;

	try {
		const { helpers, messages, repliedMessage } = await fetchMessagesAndHelpers(msg);
		if (helpers.length === 0) return;
		const buttons: ButtonBuilder[] = [new ButtonBuilder().setCustomId("cancel-point").setLabel("Eliminar").setStyle(ButtonStyle.Danger)];

		helpers.forEach((id, index) => {
			buttons.push(
				new ButtonBuilder()
					.setCustomId("point-" + id)
					.setLabel(`${index + 1}`)
					.setStyle(ButtonStyle.Primary)
			);
		});

		const fields = buildFields({
			gratitudeMessage: msg,
			messages,
			repliedMessage,
			helpers,
		});

		await sendHelpNotification(msg, fields, buttons);
		return;
	} catch (error: any) {
		console.error("Error en checkHelp:", error);
		await sendErrorReport(msg, error, "checkHelp", msg.url);
		return;
	}
}
