// types/middleware.ts
import { APIEmbedField, ChatInputCommandInteraction, EmbedBuilder, GuildMember, RestOrArray, User } from "discord.js";
import { IHelperPointDocument } from "../Models/HelperPoint.ts";

export interface CommonMessage {
	channel: string;
	content: string;
}

export interface EmbedMessage {
	channel: string;
	user: User;
	description: string;
	fields: APIEmbedField[];
}

export interface PostHandleable {
	helperPoint?: IHelperPointDocument;
	guildMember?: GuildMember;
	logMessages?: (CommonMessage | EmbedMessage)[];
	reactOkMessage?: string | null;
	reactWarningMessage?: string | null;
}

export type Middleware = (interaction: ChatInputCommandInteraction, next: () => Promise<void>) => Promise<void>;
export type Finalware = (interaction: ChatInputCommandInteraction, result: Partial<PostHandleable>) => Promise<void>;
