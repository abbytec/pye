import { CoreClient } from "../CoreClient.js";
import { IMoney, Money } from "../../Models/Money.js";
import { Users } from "../../Models/User.js";
import { VoiceChannel } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { IService } from "../IService.js";

interface VoiceFarming {
	date: Date;
	count: number;
}

export default class EconomyService implements IService {
	public readonly serviceName = "economy";
	public readonly moneyConfigs = new Map<string, IMoney>();
	public readonly voiceFarmers = new Map<string, VoiceFarming>();
	public static bankAvgCoins = 100_000;

	constructor(private readonly client: CoreClient) {}

	public getConfig(clientId: string): IMoney {
		return (
			this.moneyConfigs.get(clientId) ?? {
				_id: clientId,
				bump: 2000,
				voice: { time: 60000, coins: 100 },
				text: { time: 3000, coins: 10 },
			}
		);
	}

	async start() {
		console.log("loading money configs");
		const configs = await Money.find().catch((error) => {
			ExtendedClient.logError("Error al cargar configuraciones de dinero", error.stack, process.env.CLIENT_ID);
			return [];
		});
		configs.forEach((c) => this.moneyConfigs.set(c._id, c));

		console.log("loading present voice farmers");
		const voiceChannels = ExtendedClient.guild?.channels.cache.filter((channel) => channel.isVoiceBased());
		voiceChannels?.forEach((channel) => {
			const voiceChannel = channel as VoiceChannel;
			const members = voiceChannel.members.filter((member) => !member.user.bot).map((member) => member);
			if (members.length > 0) {
				members.forEach((member) => {
					this.voiceFarmers.set(member.id, { date: new Date(), count: 0 });
				});
			}
		});

		setInterval(() => this.processVoiceFarmers(), 60_000);

		await this.dailyRepeat();
	}

	async dailyRepeat() {
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

	private processVoiceFarmers() {
		const now = new Date();
		const moneyConfig = this.getConfig(process.env.CLIENT_ID ?? "");
		const timeInterval = moneyConfig.voice.time;

		this.voiceFarmers.forEach(async (value, userId) => {
			const timePassed = now.getTime() - value.date.getTime();
			const cyclesPassed = Math.floor(timePassed / timeInterval);

			const voice = this.client.guilds.cache.get(process.env.GUILD_ID ?? "")?.members.cache.get(userId)?.voice;
			if (!voice) {
				this.voiceFarmers.delete(userId);
				return;
			}

			if (cyclesPassed > value.count) {
				const cyclesToIncrement = cyclesPassed - value.count;
				value.count = cyclesPassed;
				Users.findOneAndUpdate(
					{ id: userId.toString() },
					{ $inc: { cash: moneyConfig.voice.coins * cyclesToIncrement } },
					{ upsert: true, new: true }
				).exec();
				this.voiceFarmers.set(userId, value);
			}
		});
	}
}
