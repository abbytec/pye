import { FunctionDeclaration, SchemaType } from "@google/generative-ai";

const USER_MEMORY = new Map<string, DatedUserMemoryResponse[]>();

export function saveUserPreferences(uid: string, likes: string[], wants: string[]): void {
	if (!USER_MEMORY.has(uid)) {
		USER_MEMORY.set(uid, [{ date: new Date(), memory: { likes: likes ?? [], wants: wants ?? [] } }]);
	} else {
		const userMemories = USER_MEMORY.get(uid);
		if (userMemories) {
			const allLikes = new Set(userMemories.flatMap((entry) => entry.memory.likes));
			const allWants = new Set(userMemories.flatMap((entry) => entry.memory.wants));

			const newLikes = likes?.filter((like) => !allLikes.has(like)) ?? [];
			const newWants = wants?.filter((want) => !allWants.has(want)) ?? [];

			if (newLikes.length > 0 || newWants.length > 0) {
				userMemories.push({ date: new Date(), memory: { likes: [...newLikes], wants: [...newWants] } });
			}
		}
	}
}

export function getUserMemories(uid: string): string {
	const memories = USER_MEMORY.get(uid);
	if (!memories || memories.length === 0) {
		return "";
	}

	let allLikes: string[] = [];
	let allWants: string[] = [];

	for (const { memory } of memories) {
		allLikes.push(...memory.likes);
		allWants.push(...memory.wants);
	}
	allLikes = allLikes.filter((like) => like.length > 0);
	allWants = allWants.filter((want) => want.length > 0);

	const resultParts: string[] = [];
	if (allLikes.length > 0) {
		resultParts.push(`Me gusta: ${allLikes.join(", ")}`);
	}
	if (allWants.length > 0) {
		resultParts.push(`Quiero/espero: ${allWants.join(", ")}`);
	}

	return resultParts.length !== 0 ? resultParts.join("\n") + "\n" : "";
}

setInterval(() => {
	const now = new Date();
	USER_MEMORY.forEach((datedMemories, key) => {
		datedMemories.forEach((memory, index) => {
			const timePassed = now.getTime() - memory.date.getTime();
			if (timePassed > 5 * 60 * 1000) {
				datedMemories.splice(index, 1);
			}
		});
	});
}, 60 * 1000);

export const saveUserPreferencesFunctionSchema: FunctionDeclaration = {
	name: "saveUserPreferences",
	description: "Guarda información sobre el usuario, incluyendo lo que le gusta, hace y lo que desea hacer.",
	parameters: {
		type: SchemaType.OBJECT,
		properties: {
			likes: {
				type: SchemaType.ARRAY,
				items: { type: SchemaType.STRING },
				description: "Lo que le gusta, disfruta o hace el usuario (array of strings).",
			},
			wants: {
				type: SchemaType.ARRAY,
				items: { type: SchemaType.STRING },
				description: "Lo que el usuario quiere o desea (array of strings).",
			},
		},
		required: [],
	},
};

interface DatedUserMemoryResponse {
	date: Date;
	memory: UserMemoryResponse;
}

export interface UserMemoryResponse {
	likes: string[];
	wants: string[];
}
