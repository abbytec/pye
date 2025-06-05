import { Client, GatewayIntentBits, Partials } from "discord.js";

export class CoreClient extends Client {
	constructor() {
		super({
			intents: [
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildInvites,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildModeration,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.GuildMessageReactions,
				GatewayIntentBits.GuildPresences,
				GatewayIntentBits.GuildVoiceStates,
				GatewayIntentBits.MessageContent,
			],
			partials: [Partials.GuildMember, Partials.Channel, Partials.Reaction, Partials.Message, Partials.ThreadMember, Partials.User],
		});
	}
}
