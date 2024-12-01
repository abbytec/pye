import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import loadEnvVariables from "../environment.js";

loadEnvVariables();
const genAI = new GoogleGenerativeAI(process.env.gemini_API_KEY ?? "");
const generationConfigzzz = {
	temperature: 0.7,
	topK: 15,
	topP: 1,
};

const safetySettingszzz = [
	{
		category: HarmCategory.HARM_CATEGORY_HARASSMENT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
	{
		category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
		threshold: HarmBlockThreshold.BLOCK_NONE,
	},
];

export const geminiModel = genAI.getGenerativeModel({
	model: "gemini-1.5-flash",
	generationConfig: generationConfigzzz,
	safetySettings: safetySettingszzz,
	systemInstruction:
		"Eres alguien que ayuda a programadores con sus problemas y dudas a los demas, intenta resolver, ayudar y explicar en pocas palabras los problemas de codigo de los demas porgramadores de manera clara y simple.",
});
