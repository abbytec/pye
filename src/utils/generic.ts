import {
	ActionRowBuilder,
	AnyThreadChannel,
	Attachment,
	ButtonBuilder,
	ButtonStyle,
	Collection,
	EmbedBuilder,
	Message,
	TextChannel,
	ThreadChannel,
} from "discord.js";
import { COLORS } from "./constants.js";
import { TextMessages } from "../Models/TextMessages.js";
import { ICouple } from "../interfaces/IUser.js";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";
import path from "path";
import fs from "fs";

export const getRandomNumber = (min = 0, max = 1) => (Math.random() * (max - min) + min) | 0;

/**
 * Formats a time duration in milliseconds to a human-readable string.
 * @param milliseconds - The time duration in milliseconds.
 * @returns A formatted time string.
 */
export function formatTime(milliseconds: number): string {
	const totalSeconds = Math.floor(milliseconds / 1000);

	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const hoursDisplay = hours > 0 ? `${hours}h ` : "";
	const minutesDisplay = minutes > 0 ? `${minutes}m ` : "";
	const secondsDisplay = seconds > 0 ? `${seconds}s` : "";

	return `${hoursDisplay}${minutesDisplay}${secondsDisplay}`.trim();
}

export function capitalizeFirstLetter(string: string) {
	return string.charAt(0).toUpperCase() + string.slice(1);
}

export async function generateLeaderboard(
	page: number,
	user: any,
	disable: boolean,
	options: {
		title: string;
		dataFetch: () => Promise<any[]>;
		sortFunction: (a: any, b: any) => number;
		positionFinder: (data: any[], userId: string) => number;
		descriptionBuilder: (item: any, index: number, start: number) => Promise<string>;
	}
) {
	const ITEMS_PER_PAGE = 10;

	// Obtener los datos
	const data = await options.dataFetch();

	// Ordenar los datos
	data.sort(options.sortFunction);

	const totalItems = data.length;
	const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
	page = Math.min(page, totalPages);

	const position = options.positionFinder(data, user.id);

	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE;
	const items = data.slice(start, end);

	const descriptions = await Promise.all(
		items.map(async (item, i) => {
			return options.descriptionBuilder(item, i, start);
		})
	);

	const embedDescription = descriptions.join("\n") || "No hay usuarios en el top.";

	const embed = new EmbedBuilder()
		.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
		.setTitle(options.title)
		.setDescription(embedDescription)
		.addFields([
			{
				name: "Tu posición",
				value: position !== -1 ? `#${position + 1}` : "No te encontré en el top.",
			},
		])
		.setFooter({ text: `Página ${page}/${totalPages}` })
		.setColor(COLORS.pyeLightBlue)
		.setTimestamp();

	const backButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Primary)
		.setLabel("«")
		.setCustomId("topBack")
		.setDisabled(page <= 1 || disable);

	const nextButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Primary)
		.setLabel("»")
		.setCustomId("topNext")
		.setDisabled(page >= totalPages || disable);

	const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, nextButton);

	return { embed, actionRow };
}

export async function checkRole(msg: Message<boolean> | IPrefixChatInputCommand, roleId: string, limit: number, roleName?: string) {
	if (!msg.guild) return;
	let member = msg instanceof Message ? msg.member : msg.guild.members.cache.get(msg.user.id);
	if (member?.roles.cache.has(roleId)) return;
	let autor = msg instanceof Message ? msg.author.id : msg.user.id;
	let data = await TextMessages.findOneAndUpdate(
		{ channelId: roleName ?? msg.channel?.id, id: autor },
		{ $inc: { messages: 1 } },
		{ new: true, upsert: true }
	);
	if (data?.messages >= limit) {
		await member?.roles.add(roleId).catch(() => null);
	}
}

export function calculateJobMultiplier(job: string | undefined, profit: number, couples: ICouple[], isGame: boolean = true) {
	if ((job === "Enfermero" || job === "Enfermera") && couples.some((s) => s.job === "Doctor" || s.job === "Doctora")) {
		profit += profit * 0.5;
	}
	if ((job === "Doctor" || job === "Doctora") && couples.some((s) => s.job === "Enfermero" || s.job === "Enfermera")) {
		profit += profit * 0.5;
	}
	if (isGame && (job === "Bombero" || job === "Bombera")) profit += Math.ceil(profit * 0.35);
	return Math.floor(profit);
}

export function convertMsToUnixTimestamp(millisecondsUntilEvent: number): number {
	const targetDate = new Date(Date.now() + millisecondsUntilEvent);
	const unixTimestamp = Math.floor(targetDate.getTime() / 1000);
	return unixTimestamp;
}

export function splitMessage(text: string, maxLength: number): string[] {
	const paragraphs = text.split("\n").filter((p) => p.trim().length > 0);
	const chunks: string[] = [];
	let currentChunk = "";

	for (const paragraph of paragraphs) {
		// Añade un salto de línea si no es el primer párrafo en el chunk
		const separator = currentChunk.length > 0 ? "\n" : "";
		const prospectiveLength = currentChunk.length + separator.length + paragraph.length;

		if (prospectiveLength <= maxLength) {
			currentChunk += `${separator}${paragraph}`;
		} else if (paragraph.length > maxLength) {
			// Si el párrafo es demasiado largo, dividir por palabras
			const splitParagraphs = splitLongParagraph(paragraph, maxLength);
			for (const splitPart of splitParagraphs) {
				if (currentChunk.length + splitPart.length + (currentChunk.length > 0 ? "\n" : "").length > maxLength) {
					if (currentChunk.length > 0) {
						chunks.push(currentChunk);
						currentChunk = "";
					}
				}
				currentChunk += (currentChunk.length > 0 ? "\n" : "") + splitPart;
			}
		} else {
			if (currentChunk.length > 0) {
				chunks.push(currentChunk);
			}
			currentChunk = paragraph;
		}
	}

	if (currentChunk.length > 0) {
		chunks.push(currentChunk);
	}

	return chunks;
}

/**
 * Divide un párrafo muy largo en partes que no excedan el límite de caracteres.
 * @param paragraph Párrafo a dividir.
 * @param maxLength Longitud máxima por parte.
 * @returns Arreglo de partes divididas.
 */
function splitLongParagraph(paragraph: string, maxLength: number): string[] {
	const words = paragraph.split(" ");
	const splitParts: string[] = [];
	let currentPart = "";

	for (const word of words) {
		const prospectiveLength = currentPart.length + (currentPart.length > 0 ? " ".length : 0) + word.length;
		if (prospectiveLength > maxLength) {
			if (currentPart.length > 0) {
				splitParts.push(currentPart);
				currentPart = word;
			} else {
				// La palabra por sí sola excede el límite, se fuerza el corte
				splitParts.push(word.slice(0, maxLength));
				currentPart = word.slice(maxLength);
			}
		} else {
			currentPart += (currentPart.length > 0 ? " " : "") + word;
		}
	}

	if (currentPart.length > 0) {
		splitParts.push(currentPart);
	}

	return splitParts;
}

export function findEmojis(text: string) {
	// Este patrón busca combinaciones de banderas (dos caracteres de 1F1E6–1F1FF) o
	// rangos típicos de emojis (desde 1F300 hasta 1FAFF, además de algunos símbolos clásicos).
	const emojiRegex =
		/([\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F6FF}\u{1F900}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/gu;

	const matches = text.match(emojiRegex);
	return matches || [];
}

const MAX_ATTACHMENT_SIZE = 7 * 1024 * 1024;

const SUPPORTED_MIME_TYPES_REGEX =
	/^(application\/pdf|audio\/(?:mpeg|mp3|wav)|image\/(?:png|jpeg|webp)|text\/plain|video\/(?:mov|mpeg|mp4|mpg|avi|wmv|mpegps|flv))$/;

export async function getFirstValidAttachment(
	attachments: Collection<string, Attachment>
): Promise<{ mimeType: string; base64: string } | undefined> {
	const validAttachment = attachments.find((att) => att.contentType && SUPPORTED_MIME_TYPES_REGEX.test(att.contentType));
	if (!validAttachment) return undefined;

	// Verifica si el tamaño del archivo supera el límite permitido
	if (validAttachment.size && validAttachment.size > MAX_ATTACHMENT_SIZE) {
		return Promise.reject(new Error("El archivo es demasiado grande."));
	}

	try {
		const response = await fetch(validAttachment.url);
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		return {
			mimeType: validAttachment.contentType ?? "",
			base64: buffer.toString("base64"),
		};
	} catch (err) {
		return undefined;
	}
}

/**
 * Checks if the provided MIME type is a valid text MIME type.
 * @param mimeType - The MIME type to check.
 * @returns True if the MIME type is valid, false otherwise.
 */
function isValidTextMimeType(mimeType: string): boolean {
	// Text types
	if (/^text\//.test(mimeType)) {
		return true;
	}

	// Some extra types
	const extraAllowedMimeTypes = ["application/json", "application/xml", "application/x-shellscript"];

	return extraAllowedMimeTypes.includes(mimeType);
}

const MAX_TEXT_ATTACHMENT_SIZE = 3 * 1024 * 1024;

/**
 * Retrieves the content of valid text attachments from a collection of attachments.
 * @param attachments - The collection of attachments to process.
 * @returns A promise that resolves to a string containing the formatted content of the valid text attachments.
 */
export async function getTextAttachmentsContent(attachments: Collection<string, Attachment>): Promise<string> {
	let formattedContent = "";
	let currentSize = 0;

	for (const attachment of attachments.values()) {
		if (!attachment.contentType || !isValidTextMimeType(attachment.contentType)) {
			continue;
		}

		if (attachment.size && attachment.size > MAX_TEXT_ATTACHMENT_SIZE) {
			formattedContent += `// ${attachment.name} - El archivo es demasiado grande para procesarlo.\n`;
			continue;
		}

		if (currentSize + attachment.size > MAX_TEXT_ATTACHMENT_SIZE) {
			break;
		}

		try {
			const response = await fetch(attachment.url);
			const arrayBuffer = await response.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			const textContent = buffer.toString("utf-8");
			formattedContent += `// ${attachment.name}\n${textContent}\n\n`;
			currentSize += attachment.size;
		} catch (err) {
			formattedContent += `// ${attachment.name} - Error al obtener el contenido.\n`;
		}
	}

	return formattedContent;
}

// Función auxiliar para obtener TODOS los mensajes del canal
async function fetchAllMessages(channel: TextChannel | AnyThreadChannel) {
	let allMessages = await channel.messages.fetch({ limit: 100 });
	let lastId = allMessages.last()?.id;
	while (lastId) {
		const options: { limit: number; before?: string } = { limit: 100 };
		options.before = lastId;
		const messages = await channel.messages.fetch(options);
		if (messages.size === 0) break;
		allMessages = allMessages.concat(messages);
		lastId = messages.last()?.id;
	}
	return allMessages;
}

// Función para generar la transcripción en HTML y guardarla en un archivo temporal
export async function saveTranscript(channel: TextChannel | AnyThreadChannel, title = "Transcripción del Ticket"): Promise<string> {
	const transcriptsDir = path.resolve(process.cwd(), "transcripts");
	if (!fs.existsSync(transcriptsDir)) {
		fs.mkdirSync(transcriptsDir, { recursive: true });
	}

	const messages = await fetchAllMessages(channel);
	const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

	let htmlContent = `
  <html>
	<head>
	  <meta charset="UTF-8">
	  <title>${title}</title>
	  <style>
		body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
		.message { margin-bottom: 10px; padding: 10px; background: #fff; border-radius: 5px; }
		.author { font-weight: bold; }
		.time { color: #555; font-size: 0.85em; }
	  </style>
	</head>
	<body>
	  <h1>${title}</h1>
  `;

	sortedMessages.forEach((msg) => {
		const time = new Date(msg.createdTimestamp).toLocaleString();
		if (msg.content) {
			const content = msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
			htmlContent += `
	  <div class="message">
		<div class="author">${msg.author.tag} <span class="time">[${time}]</span></div>
		<div class="content">${content}</div>
	  </div>
	`;
		}
		if (msg.embeds.length > 0) {
			htmlContent += `
	  <div class="message">
		<div class="author">${msg.author.tag} <span class="time">[${time}]</span></div>
		<div class="content">${msg.embeds.map((e) => e.description + e.fields.map((f) => f.name + "\n" + f.value).join(" "))}</div>
	  </div>
	`;
		}
		if (msg.attachments.size > 0) {
			htmlContent += `
	  <div class="message">
		<div class="author">${msg.author.tag} <span class="time">[${time}]</span></div>
		<div class="content">${msg.attachments.map((a) => `<a href="${a.url}">${a.name}</a>`).join(" ")}</div>
	  </div>
	`;
		}
	});

	htmlContent += `
	</body>
  </html>
  `;

	const filePath = path.join(transcriptsDir, `transcript-${channel.id}.html`);
	fs.writeFileSync(filePath, htmlContent, "utf8");
	return filePath;
}

export function getYesterdayUTC(): Date {
	const now = new Date();
	now.setDate(now.getDate() - 1);
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
}

export function getTodayUTC() {
	const now = new Date();
	return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
}
