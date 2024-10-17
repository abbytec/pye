// types/middleware.ts
import { ChatInputCommandInteraction, GuildMember } from "discord.js";
import { IHelperPointModel } from "../Models/HelperPoint.ts";

export interface PostHandleable {
	helperPoint: IHelperPointModel;
	guildMember: GuildMember;
	finalMessages: {
		channel: string;
		content: string;
	}[];
}

export type Middleware = (interaction: ChatInputCommandInteraction, next: () => Promise<void>) => Promise<void>;
export type Finalware = (interaction: ChatInputCommandInteraction & Partial<PostHandleable>) => Promise<void>;
