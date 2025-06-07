import {
	User,
	Role,
	Channel,
	MessagePayload,
	MessageReplyOptions,
	InteractionReplyOptions,
	Guild,
	GuildMember,
	Message,
	APIInteractionGuildMember,
	BooleanCache,
	CacheType,
	Attachment,
	InteractionEditReplyOptions,
} from "discord.js";
import { ExtendedClient } from "../client.js";

export interface IOptions {
	getString: ((name: string, required?: boolean) => string | null) & ((name: string, required: true) => string);
	getNumber: ((name: string, required?: boolean) => number | null) & ((name: string, required: true) => number);
	getBoolean: ((name: string, required?: boolean) => boolean | null) & ((name: string, required: true) => boolean);
	getUser: ((name: string, required?: boolean) => Promise<User | null>) & ((name: string, required: true) => Promise<User | null>);
	getInteger: ((name: string, required?: boolean) => number | null) & ((name: string, required: true) => number);
	getRole: ((name: string, required?: boolean) => Promise<Role | null>) & ((name: string, required: true) => Promise<Role>);
	getSubcommand: ((required?: any) => string | null) & ((required: true) => string);
	getChannel: ((name: string, required?: boolean) => Promise<Channel | null>) & ((name: string, required: true) => Promise<Channel>);
	getAttachment: ((name: string, required?: boolean) => Promise<Attachment | null>) &
		((name: string, required: true) => Promise<Attachment | null>);
}

export type MessageToSend = string | MessagePayload | MessageReplyOptions | InteractionReplyOptions;
export type MessageToEdit = string | MessagePayload | InteractionEditReplyOptions;
export interface IPrefixChatInputCommand {
	client: ExtendedClient;
	commandName: string;
	options: IOptions;
	guild: Guild | null;
	guildId: string | null;
	member: GuildMember | APIInteractionGuildMember | null;
	user: User;
	channel: Channel;
	channelId: string;
	reply: (options: MessageToSend) => Promise<Message>;
	editReply: (options: MessageToEdit) => Promise<Message>;
	deleteReply: () => Promise<void>;
	deferReply: (options: any) => Promise<void>;
	fetchReply: () => Promise<Message>;
	followUp: (content: MessageToSend) => Promise<Message<BooleanCache<CacheType>>>;
	replied: boolean;
	deferred: boolean;
	_reply?: Promise<Message>;
	message?: Message;
	showModal?: (options: any) => Promise<void>;
}

export class ParameterError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ParameterError";
	}
}
