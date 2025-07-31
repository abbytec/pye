import { APIEmbed } from "discord.js";

export interface ICustomCommand {
	name: string;
	embeds?: APIEmbed[];
	content?: string;
}
