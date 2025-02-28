import { FunctionDeclaration, SchemaType } from "@google/generative-ai";

const USER_MEMORY = new Map<string, DatedUserMemoryResponse[]>();

export function saveUserPreferences(uid: string, likes: string[], wants: string[]): void {
	if (!USER_MEMORY.has(uid)) {
		USER_MEMORY.set(uid, [{ date: new Date(), memory: { likes: likes ?? [], wants: wants ?? [] } }]);
	} else {
		USER_MEMORY.get(uid)?.push({ date: new Date(), memory: { likes, wants } });
	}
}

export function getUserMemories(uid: string): string {
	const memories = USER_MEMORY.get(uid);
	if (!memories || memories.length === 0) {
		return "";
	}

	const allLikes: string[] = [];
	const allWants: string[] = [];

	for (const { memory } of memories) {
		allLikes.push(...memory.likes);
		allWants.push(...memory.wants);
	}

	const resultParts: string[] = [];
	if (allLikes.length > 0) {
		resultParts.push(`Al usuario le gusta: ${allLikes.join(", ")}`);
	}
	if (allWants.length > 0) {
		resultParts.push(`El usuario quiere/espera: ${allWants.join(", ")}`);
	}

	return resultParts.join("\n");
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
