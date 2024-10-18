// types/middleware.ts
import { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { IHelperPointDocument } from "../Models/HelperPoint.ts";

export interface PostHandleable {
	helperPoint: IHelperPointDocument;
	guildMember: GuildMember;
	finalMessages: {
		channel: string;
		content: string;
	}[];
	reactOkMessage?: string;
	reactWarningMessage?: string;
}

export type Middleware = (interaction: ChatInputCommandInteraction, next: () => Promise<void>) => Promise<void>;
export type Finalware = (interaction: ChatInputCommandInteraction, result: Partial<PostHandleable>) => Promise<void>;
