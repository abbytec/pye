import { CoreClient } from "../CoreClient.js";
import { getRandomNumber } from "../../utils/generic.js";
import { IPetDocument, Pets } from "../../Models/Pets.js";
import { Home } from "../../Models/Home.js";
import { TextChannel } from "discord.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { IService } from "../IService.js";

export default class PetService implements IService {
	public readonly serviceName = "pets";
	constructor(private readonly client: CoreClient) {}

	start() {
		/* 6h30m */ setInterval(() => this.checkPets(this.client), 23400000);
		/* 8 h  */ setInterval(() => this.checkFood(), 28800000);
		/* 4 h  */ setInterval(() => this.checkMood(), 14400000);
		/* 5 h  */ setInterval(() => this.checkShower(), 18000000);
	}
	private async checkFood() {
		const arr = await Pets.find().exec();
		if (!arr.length) return;
		for (const data of arr) {
			this.minFeed(data);
		}
	}

	private async checkMood() {
		const arr = await Pets.find().exec();
		if (!arr.length) return;
		for (const data of arr) {
			this.minPlay(data);
		}
	}

	private async checkShower() {
		const arr = await Pets.find().exec();
		if (!arr.length) return;
		for (const data of arr) {
			this.minClean(data);
		}
	}

	private async minFeed(petInfo: IPetDocument) {
		if (!petInfo) return;
		const total = getRandomNumber(5, 12);
		if (petInfo.food - total < 0) petInfo.food = 0;
		else petInfo.food -= total;
		return await petInfo.save();
	}

	private async minClean(petInfo: IPetDocument) {
		if (!petInfo) return;
		const total = getRandomNumber(5, 12);
		if (petInfo.shower - total < 0) petInfo.shower = 0;
		else petInfo.shower -= total;
		return await petInfo.save();
	}

	private async minPlay(petInfo: IPetDocument) {
		if (!petInfo) return;
		const total = getRandomNumber(5, 12);
		if (petInfo.mood - total < 0) petInfo.mood = 0;
		else petInfo.mood -= total;
		return await petInfo.save();
	}

	private async checkPets(client: CoreClient) {
		const arr = await Pets.find().exec();
		let badge = false;
		if (!arr.length) return;
		for (const getData of arr) {
			if (getData && !getData?.mood && !getData?.food && !getData?.shower) {
				if (badge) return;
				badge = true;
				setTimeout(async () => {
					const home = await Home.findOne({ id: getData.id }).exec();
					if (!home) {
						await getData.deleteOne();
						return;
					}
					await home.updateOne({ text: 0, pet: "none", level: 12, house: { level: 12, color: "Naranja" }, active: false }).exec();
					await getData.deleteOne();
					(client.channels.resolve(getChannelFromEnv("casinoPye")) as TextChannel)?.send(
						`<:petgone:1008539448637665300> - La mascota de <@${getData.id}> se ha escapado debido a que no fue un buen dueño...\nPuedes volver a completar la ultima quest para tener otra mascota, cuidala mejor esta vez!`
					);
				}, 7200000);
			}
		}
	}
}
