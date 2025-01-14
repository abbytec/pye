import {
	ChatInputCommandInteraction,
	TextBasedChannel,
	Role,
	User,
	Channel,
	Message,
	InteractionReplyOptions,
	MessagePayload,
	Attachment
} from "discord.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { replyError } from "./replyError.js";

export function chatInputCommandParser(interaction: ChatInputCommandInteraction): IPrefixChatInputCommand {
	return {
		client: interaction.client as ExtendedClient,
		commandName: interaction.commandName,
		options: {
			getString: interaction.options.getString.bind(interaction.options),
			getNumber: interaction.options.getNumber.bind(interaction.options),
			getBoolean: interaction.options.getBoolean.bind(interaction.options),
			getUser: async (name: string, required?: boolean): Promise<User | null> => {
				const user = interaction.options.getUser(name, required);
				if (required && !user) {
					await replyError(interaction, `El usuario requerido "${name}" no fue proporcionado.`);
					return null;
				}
				return user;
			},
			getInteger: interaction.options.getInteger.bind(interaction.options),
			getRole: async (name: string, required?: boolean): Promise<any> => {
				const role = interaction.options.getRole(name, required) as Role | null;
				if (required && !role) {
					throw new Error(`El rol requerido "${name}" no fue proporcionado.`);
				}
				return role;
			},
			getSubcommand: interaction.options.getSubcommand.bind(interaction.options),
			getChannel: async (name: string, required?: boolean): Promise<any> => {
				const channel = interaction.options.getChannel(name, required) as Channel | null;
				if (required && !channel) {
					throw new Error(`El canal requerido "${name}" no fue proporcionado.`);
				}
				return channel;
			},
			getAttachment: async (name: string, required?: boolean): Promise<Attachment | null> => {
				const attachment = interaction.options.getAttachment(name, required);
				if (required && !attachment) {
					await replyError(interaction, `El archivo adjunto requerido "${name}" no fue proporcionado.`);
					return null;
				}
				return attachment;
			}
		},
		guild: interaction.guild,
		guildId: interaction.guildId,
		member: interaction.member,
		user: interaction.user,
		channel: interaction.channel as TextBasedChannel,
		channelId: interaction.channelId,
		reply: (args): Promise<any> => {
			return interaction.reply(args as InteractionReplyOptions | string | MessagePayload).catch((err) => {
				ExtendedClient.logError("Error al responder a la interacción slash " + err.message, err.stack, interaction.user.id);
			});
		},
		editReply: interaction.editReply.bind(interaction),
		deleteReply: interaction.deleteReply.bind(interaction),
		deferReply: (...args): Promise<any> => {
			return interaction.deferReply(...args);
		},
		followUp: interaction.followUp.bind(interaction) as any,
		get replied() {
			return interaction.replied;
		},
		get deferred() {
			return interaction.deferred;
		},
		fetchReply: (): Promise<Message> => {
			return interaction.fetchReply("@original");
		},
	};
}
