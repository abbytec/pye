import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, GuildMember, Message } from "discord.js";
import { COLORS } from "./constants.js";
import { TextMessages } from "../Models/TextMessages.js";
import { ICouple } from "../interfaces/IUser.js";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";

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
