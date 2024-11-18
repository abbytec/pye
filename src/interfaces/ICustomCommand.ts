import { APIEmbed } from "discord.js";

interface IEmbed {
	title: string;
	description: string;
	color?: string;
	fields?: { name: string; value: string }[];
	thumbnail?: {
		url: string;
	};
	footer?: {
		text: string;
	};
}

export interface ICustomCommand {
	name: string;
	embeds: APIEmbed[];
}
