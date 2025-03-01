import { FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { ExtendedClient } from "../../client.js";
import natural from "natural";
import { pyeChanPrompt } from "./gemini.js";

export async function scheduleDMReminder(reminderDateTime: string, message: string, userId: string) {
	if (natural.JaroWinklerDistance(message, pyeChanPrompt) > 0.8) {
		return;
	}
	const reminderTime = new Date(reminderDateTime);
	const now = new Date();
	if (reminderTime < now || reminderTime > new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)) {
		return;
	}
	await ExtendedClient.agenda.schedule(reminderTime, "send reminder dm", {
		userId,
		message: message,
	});
}

export const createReminderFunctionSchema: FunctionDeclaration = {
	name: "createReminder",
	description: "Crea un recordatorio para enviarle un mensaje directo al usuario en una fecha/hora (en formato ISO 8601) específica.",
	parameters: {
		type: SchemaType.OBJECT,
		properties: {
			reminderTime: {
				type: SchemaType.STRING,
				description: "La fecha y hora (en formato ISO 8601) en la que se debe enviar el recordatorio.",
				format: "date-time",
			},
			message: {
				type: SchemaType.STRING,
				description: "El mensaje que se enviará como recordatorio.",
			},
		},
		required: ["reminderTime", "message"],
	},
};

export interface Reminder {
	reminderTime: string;
	message: string;
}

export function getActualDateTime() {
	const now = new Date();
	return "Fecha y hora actual: " + now.toISOString();
}
