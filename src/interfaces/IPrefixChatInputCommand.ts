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
} from "discord.js";
import { ExtendedClient } from "../client.js";

export interface IOptions {
	getString: ((name: string, required?: boolean) => string | null) & ((name: string, required: true) => string);
	getNumber: ((name: string, required?: boolean) => number | null) & ((name: string, required: true) => number);
	getBoolean: ((name: string, required?: boolean) => boolean | null) & ((name: string, required: true) => boolean);
	getUser: ((name: string, required?: boolean) => Promise<User | null>) & ((name: string, required: true) => Promise<User>);
	getInteger: ((name: string, required?: boolean) => number | null) & ((name: string, required: true) => number);
	getRole: ((name: string, required?: boolean) => Promise<Role | null>) & ((name: string, required: true) => Promise<Role>);
	getSubcommand: ((required?: any) => string | null) & ((required: true) => string);
	getChannel: ((name: string, required?: boolean) => Promise<Channel | null>) & ((name: string, required: true) => Promise<Channel>);
}

type messageToSend = string | MessagePayload | MessageReplyOptions | InteractionReplyOptions;
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
	reply: (options: messageToSend) => Promise<Message>;
	editReply: (options: messageToSend) => Promise<Message>;
	deleteReply: () => Promise<void>;
	deferReply: (options: any) => void;
	followUp: (content: messageToSend) => Promise<Message<BooleanCache<CacheType>>>;
	replied: boolean;
	deferred: boolean;
	_reply?: Message;
}
