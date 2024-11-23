import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, GuildMember, Message } from "discord.js";
import { COLORS } from "./constants.ts";
import { TextMessages } from "../Models/TextMessages.ts";
import { ICouple } from "../interfaces/IUser.ts";

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

export async function checkRole(msg: Message<boolean>, roleId: string, limit: number, roleName?: string) {
	if ((msg.member as GuildMember).roles.cache.has(roleId)) return;
	let data = await TextMessages.findOneAndUpdate(
		{ channelId: roleName ?? msg.channel.id, id: msg.author.id },
		{ $inc: { messages: 1 } },
		{ new: true, upsert: true }
	);
	if (data?.messages >= limit) {
		(msg.member as GuildMember).roles.add(roleId).catch(() => null);
	}
}

export function calculateJobMultiplier(job: string | undefined, profit: number, couples: ICouple[]) {
	if ((job === "Enfermero" || job === "Enfermera") && couples.some((s) => s.job === "Doctor" || s.job === "Doctora")) {
		profit += profit * 0.5;
	}
	if ((job === "Doctor" || job === "Doctora") && couples.some((s) => s.job === "Enfermero" || s.job === "Enfermera")) {
		profit += profit * 0.5;
	}
	if (job === "Bombero" || job === "Bombera") profit += Math.ceil(profit * 0.35);
	return Math.floor(profit);
}

export function convertMsToUnixTimestamp(millisecondsUntilEvent: number): number {
	const targetDate = new Date(Date.now() + millisecondsUntilEvent);
	const unixTimestamp = Math.floor(targetDate.getTime() / 1000);
	return unixTimestamp;
}
