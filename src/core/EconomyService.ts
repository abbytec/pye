import { CoreClient } from "./CoreClient.js";
import { IMoney, Money } from "../Models/Money.js";
import { Users } from "../Models/User.js";
import { Guild, VoiceChannel } from "discord.js";
import { ExtendedClient } from "../client.js";

interface VoiceFarming {
	date: Date;
	count: number;
}

export class EconomyService {
	public readonly moneyConfigs = new Map<string, IMoney>();
	public readonly voiceFarmers = new Map<string, VoiceFarming>();
	public static bankAvgCoins = 100_000;

	constructor(private readonly client: CoreClient) {}

	public getConfig(guildId: string): IMoney {
		return (
			this.moneyConfigs.get(guildId) ?? {
				_id: guildId,
				bump: 2000,
				voice: { time: 60000, coins: 100 },
				text: { time: 3000, coins: 10 },
			}
		);
	}

	async loadMoneyConfigs() {
		console.log("loading money configs");
		const configs = await Money.find().catch((error) => {
			ExtendedClient.logError("Error al cargar configuraciones de dinero", error.stack, process.env.CLIENT_ID);
			return [];
		});
		configs.forEach((c) => this.moneyConfigs.set(c._id, c));
	}

	async refreshBankAverage() {
		const avg = await Users.aggregate([{ $match: { bank: { $ne: 0 } } }, { $group: { _id: null, average: { $avg: "$bank" } } }]).catch(
			() => []
		);
		EconomyService.bankAvgCoins = avg[0]?.average ?? EconomyService.bankAvgCoins;
	}

	public static getInflatedRate(amount: number, div = 1) {
		return Math.round((amount * EconomyService.bankAvgCoins) / (100000 * div));
	}

	public static getGameMaxCoins(div = 1) {
		return Math.round(EconomyService.bankAvgCoins / (3 * div));
	}

	voiceChannelRead(guild: Guild) {
		const voiceChannels = guild?.channels.cache.filter((channel) => channel.isVoiceBased());
		voiceChannels?.forEach((channel) => {
			const voiceChannel = channel as VoiceChannel;
			const members = voiceChannel.members.filter((member) => !member.user.bot).map((member) => member);
			if (members.length > 0) {
				members.forEach((member) => {
					this.voiceFarmers.set(member.id, { date: new Date(), count: 0 });
				});
			}
		});
	}
}
