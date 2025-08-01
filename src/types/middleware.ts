// types/middleware.ts
import { APIEmbedField, AttachmentBuilder, GuildMember, User } from "discord.js";
import { IHelperPointDocument } from "../Models/HelperPoint.js";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";

export interface CommonMessage {
	channel: string;
	content: string;
}

export interface EmbedMessage {
	channel: string;
	user: User;
	description: string;
	fields: APIEmbedField[];
	attachments?: AttachmentBuilder[];
}

export interface PostHandleable {
	helperPoint?: IHelperPointDocument;
	guildMember?: GuildMember;
	logMessages?: (CommonMessage | EmbedMessage)[];
	reactOkMessage?: string | null;
	reactWarningMessage?: string | null;
}

export type Middleware = (interaction: IPrefixChatInputCommand, next: () => Promise<void>) => Promise<void>;
export type Finalware = (interaction: IPrefixChatInputCommand, result: Partial<PostHandleable>) => Promise<void>;
