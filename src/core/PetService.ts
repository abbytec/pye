import { CoreClient } from "./CoreClient.js";
import { checkPets, checkFood, checkMood, checkShower } from "../commands/items-economy/pet.js";

export class PetService {
	constructor(private readonly client: CoreClient) {}

	startIntervals() {
		/* 6h30m */ setInterval(() => checkPets(this.client as any), 23400000);
		/* 8 h  */ setInterval(() => checkFood(), 28800000);
		/* 4 h  */ setInterval(() => checkMood(), 14400000);
		/* 5 h  */ setInterval(() => checkShower(), 18000000);
	}
}
