import { Message, User, TextChannel, Role, Channel, Attachment } from "discord.js";
import { PREFIX } from "../constants.js";
import { ExtendedClient } from "../../client.js";
import { IOptions, IPrefixChatInputCommand, MessageToSend, ParameterError } from "../../interfaces/IPrefixChatInputCommand.js";
import { replyError } from "./replyError.js";

interface IPrefixChatInputCommandOption {
	name: string;
	required: boolean;
	options?: string[];
}

export class PrefixChatInputCommand {
	private readonly client: ExtendedClient;
	public commandName: string;
	private readonly argsDefinition: IPrefixChatInputCommandOption[];
	private readonly argsMap: Map<string, string> = new Map();
	private message?: Message;
	private _reply?: Promise<Message>;
	private _isReplied = false;
	private _isDeferred = false;
	public aliases: string[];

	constructor(client: ExtendedClient, commandName: string, argsDefinition: IPrefixChatInputCommandOption[], aliases: string[] = []) {
		this.client = client;
		this.commandName = commandName;
		this.argsDefinition = argsDefinition;
		this.aliases = aliases;
	}

	public async parseMessage(message: Message): Promise<IPrefixChatInputCommand | null> {
		this.message = message;
		this.argsMap.clear();
		this._reply = undefined;
		this._isReplied = false;
		this._isDeferred = false;

		const content = message.content.trim();
		if (!content.startsWith(PREFIX)) return null;

		const withoutPrefix = content.slice(PREFIX.length).trim();
		const split = withoutPrefix.split(/\s+/);

		const parsedSubCommand = split.shift() ?? null;
		if (parsedSubCommand) {
			this.argsMap.set("subcommand", parsedSubCommand);
		}

		// Parseo de argumentos
		for (let i = 0; i < this.argsDefinition.length; i++) {
			const def = this.argsDefinition[i];
			const value = split[i];

			if (def.required && (value === undefined || value === "")) {
				let response = `El argumento requerido "${def.name}" no fue proporcionado.`;
				if (def.options) response += `\n**Opciones:** ${def.options.join(", ")}`;
				throw new ParameterError(response);
			}

			if (value !== undefined) {
				this.argsMap.set(def.name, value);
			}
		}
		let returnObj = {
			client: this.client,
			commandName: this.commandName,
			guild: message.guild,
			guildId: message.guildId,
			member: message.member ?? undefined,
			user: message.author,
			channel: message.channel,
			channelId: message.channel.id,
			reply: this.reply.bind(this),
			editReply: this.editReply.bind(this),
			deleteReply: this.deleteReply.bind(this),
			deferReply: this.deferReply.bind(this),
			followUp: this.followUp.bind(this),
			get replied() {
				return this._isReplied;
			},
			get deferred() {
				return this._isDeferred;
			},
			fetchReply: async () => await this._reply,
		} as IPrefixChatInputCommand & { _isReplied: boolean; _isDeferred: boolean };

		returnObj.options = this.options(returnObj);

		return returnObj;
	}

	// Métodos para obtener argumentos
	private readonly getString = (name: string, required?: boolean): string | null => {
		const val = this.argsMap.get(name);
		if (required && (val === undefined || val === null)) {
			throw new ParameterError(`El argumento requerido "${name}" no fue proporcionado.`);
		}
		return val ?? null;
	};

	private readonly getNumber = (name: string, required?: boolean): number | null => {
		const val = this.argsMap.get(name);
		if (val === undefined) {
			if (required) throw new ParameterError(`El argumento requerido "${name}" no fue proporcionado.`);
			return null;
		}
		const num = Number(val);
		if (isNaN(num)) {
			if (required) throw new ParameterError(`El argumento "${name}" no es un número válido.`);
			return null;
		}
		return num;
	};

	private readonly getBoolean = (name: string, required?: boolean): boolean | null => {
		const val = this.argsMap.get(name);
		if (val === undefined) {
			if (required) throw new ParameterError(`El argumento requerido "${name}" no fue proporcionado.`);
			return null;
		}
		return val.toLowerCase() === "true" || val === "1";
	};

	private async getUser(name: string, required?: boolean): Promise<User | null> {
		const val = this.argsMap.get(name);
		if (!val) {
			if (required) throw new ParameterError(`El argumento requerido "${name}" no fue proporcionado.`);
			return null;
		}

		const mentionMatch = RegExp(/^(?:<@!?)?(\d+)(?:>)?$/).exec(val);
		let userId = val;
		if (mentionMatch) {
			userId = mentionMatch[1];
		}

		try {
			const fetchedUser = await this.client.users.fetch(userId);
			if (!fetchedUser && required) {
				throw new ParameterError(
					`No se pudo encontrar el usuario, asegurate de ingresarlo correctamente. Si tienes dudas, usa \`/help\`.`
				);
			}
			return fetchedUser ?? null;
		} catch {
			if (required) throw new ParameterError("Error al obtener el usuario.");
			return null;
		}
	}

	private async getAttachment(name: string, required?: boolean): Promise<Attachment | null> {
		const val = this.argsMap.get(name);
	
		if (!val) {
			if (required) {
				throw new ParameterError(`El archivo adjunto requerido "${name}" no fue proporcionado.`);
			}
	
			if (this.message?.reference) {
				const repliedMessage = await this.message.channel.messages.fetch(this.message.reference.messageId ?? "");
				return repliedMessage?.attachments.first() ?? null;
			}
	
			if (this.message && this.message?.attachments.size > 0) {
				return this.message.attachments.first() ?? null;
			}
	
			return null;
		}
	
		try {
			const attachments = this.message?.attachments;
	
			if (required && (!attachments || !attachments.size)) {
				throw new ParameterError(
					`No se pudo encontrar el archivo adjunto en el mensaje proporcionado. Asegúrate de adjuntar un archivo.`
				);
			}
	
			return attachments?.first() ?? null;
		} catch (error) {
			if (required) {
				throw new ParameterError(`El archivo adjunto requerido "${name}" no fue proporcionado correctamente.`);
			}
		}
	
		return null;
	}	

	private readonly getInteger = (name: string, required?: boolean): number | null => {
		const val = this.argsMap.get(name);
		if (val === undefined) {
			if (required) throw new ParameterError(`El argumento requerido "${name}" no fue proporcionado.`);
			return null;
		}
		const int = parseInt(val, 10);
		if (isNaN(int)) {
			if (required) throw new ParameterError(`El argumento "${name}" no es un número entero válido.`);
			return null;
		}
		return int;
	};

	private async getRole(name: string, required?: boolean): Promise<Role | null> {
		const val = this.argsMap.get(name);
		if (!val) {
			if (required) throw new ParameterError(`El argumento requerido "${name}" no fue proporcionado.`);
			return null;
		}

		const mentionMatch = /^<@&(\d+)>$/.exec(val);
		let roleId = val;
		if (mentionMatch) {
			roleId = mentionMatch[1];
		}

		try {
			const guild = this.message?.guild;
			if (!guild) {
				if (required)
					throw new ParameterError(
						`No se pudo encontrar el rol para el argumento "${name}" porque el mensaje no está en un servidor.`
					);
				return null;
			}
			const role = guild.roles.cache.get(roleId);
			if (!role && required) {
				throw new ParameterError(`No se pudo encontrar el rol para el argumento "${name}".`);
			}
			return role ?? null;
		} catch {
			if (required) throw new ParameterError(`No se pudo encontrar el rol para el argumento "${name}".`);
			return null;
		}
	}

	private async getChannel(name: string, required?: boolean): Promise<Channel | null> {
		const val = this.argsMap.get(name);
		if (!val) {
			if (required) throw new ParameterError(`El argumento requerido "${name}" no fue proporcionado.`);
			return null;
		}

		const mentionMatch = /^<#(\d+)>$/.exec(val);
		let channelId = val;
		if (mentionMatch) {
			channelId = mentionMatch[1];
		}

		try {
			const guild = this.message?.guild;
			if (!guild) {
				if (required)
					throw new ParameterError(
						`No se pudo encontrar el canal para el argumento "${name}" porque el mensaje no está en un servidor.`
					);
				return null;
			}
			const channel = guild.channels.cache.get(channelId);
			if (!channel && required) {
				throw new ParameterError(`No se pudo encontrar el canal para el argumento "${name}".`);
			}
			return channel ?? null;
		} catch {
			if (required) throw new ParameterError(`No se pudo encontrar el canal para el argumento "${name}".`);
			return null;
		}
	}

	private readonly getSubcommand = (required?: boolean): string | null => {
		// Asumiendo que el subcomando es el primer argumento después del comando principal
		const subCommand = this.argsMap.get("subcommand") ?? null;

		if (required && (!subCommand || subCommand.trim() === "")) {
			throw new ParameterError(`El subcomando es requerido pero no fue proporcionado.`);
		}

		return subCommand;
	};

	private async reply(content: MessageToSend): Promise<Message> {
		if (!this.message) throw new ParameterError("No se ha parseado un mensaje aún.");
		let sentMessage: Promise<Message>;
		if (content instanceof Object && "ephemeral" in content) {
			sentMessage = this.message.reply({ ...content, options: { ephemeral: content.ephemeral } } as any);
		} else {
			sentMessage = this.message.reply(content as any);
		}
		this._reply = sentMessage;
		this._isReplied = true;
		return await sentMessage;
	}

	private async editReply(content: MessageToSend): Promise<Message> {
		if (this._isDeferred && !this._reply) return await this.reply(content);
		if (!this._reply) throw new ParameterError("No hay una respuesta previa para editar.");
		if (content instanceof Object && "ephemeral" in content) {
			return (await this._reply).edit({ ...content, options: { ephemeral: content.ephemeral } } as any);
		} else {
			return (await this._reply).edit(content as any);
		}
	}

	private async deleteReply(): Promise<void> {
		if (!this._reply) throw new ParameterError("No hay una respuesta previa para borrar.");
		await (await this._reply).delete().catch(() => null);
		this._reply = undefined;
		this._isReplied = false;
	}

	private deferReply(opts: any): void {
		this._isDeferred = true;
	}

	private async followUp(content: MessageToSend): Promise<Message> {
		if (!this.message?.channel) throw new ParameterError("No se ha parseado un mensaje aún.");
		if (content instanceof Object && "ephemeral" in content) {
			return (this.message.channel as TextChannel).send({ ...content, options: { ephemeral: content.ephemeral } } as any);
		} else {
			return (this.message.channel as TextChannel).send(content as any);
		}
	}

	private options(that: IPrefixChatInputCommand): IOptions {
		return {
			getString: this.getString.bind(this) as IOptions["getString"],
			getNumber: this.getNumber.bind(this) as IOptions["getNumber"],
			getBoolean: this.getBoolean.bind(this) as IOptions["getBoolean"],
			getUser: async (name: string, required?: boolean): Promise<any> => {
				return this.getUser(name, required).catch(async (err) => {
					await replyError(that, err);
					return null;
				});
			},
			getInteger: this.getInteger.bind(this) as IOptions["getInteger"],
			getRole: async (name: string, required?: boolean): Promise<any> => {
				return this.getRole(name, required).catch(async (err) => {
					await replyError(that, err);
					return null;
				});
			},
			getAttachment: async (name: string, required?: boolean): Promise<any> => {
				return this.getAttachment(name, required).catch(async (err) => {
					await replyError(that, err);
					return null;
				});
			},
			getSubcommand: this.getSubcommand.bind(this) as IOptions["getSubcommand"],
			getChannel: async (name: string, required?: boolean): Promise<any> => {
				return this.getChannel(name, required).catch(async (err) => {
					await replyError(that, err);
					return null;
				});
			},
		};
	}
}
