// Asegura que este archivo sea tratado como un módulo
export {};

// Importa las interfaces existentes
import { Command as ICommand } from "./src/types/command.js";

declare global {
	// Declara las interfaces en el ámbito global
	interface Command extends ICommand {}
}

import "@google/generative-ai";

declare module "@google/generative-ai" {
	interface GenerationConfig {
		responseModalities?: string[];
	}

	interface GoogleSearchRetrievalTool {
		googleSearchRetrieval?: {};
		googleSearch;
	}

	enum HarmBlockThreshold {
		/** Threshold is unspecified. */
		HARM_BLOCK_THRESHOLD_UNSPECIFIED = "HARM_BLOCK_THRESHOLD_UNSPECIFIED",
		/** Content with NEGLIGIBLE will be allowed. */
		BLOCK_LOW_AND_ABOVE = "BLOCK_LOW_AND_ABOVE",
		/** Content with NEGLIGIBLE and LOW will be allowed. */
		BLOCK_MEDIUM_AND_ABOVE = "BLOCK_MEDIUM_AND_ABOVE",
		/** Content with NEGLIGIBLE, LOW, and MEDIUM will be allowed. */
		BLOCK_ONLY_HIGH = "BLOCK_ONLY_HIGH",
		/** All content will be allowed. */
		BLOCK_NONE = "BLOCK_NONE",
		OFF = "OFF",
	}
}
