import { SlashCommandBuilder, EmbedBuilder, Attachment } from "discord.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { COLORS } from "../../utils/constants.js";
import { LANGUAGE_EXTENSIONS, LANGUAGE_PATTERNS } from "../../utils/constants/codeExecution.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { PostHandleable } from "../../types/middleware.js";
import { ExecutionResult, ExecutionRuntime, ExecutionRuntimes, CodeAnalisis } from "../../interfaces/ICodeExecution.js";
import loadEnvVariables from "../../utils/environment.js";

loadEnvVariables();

const EXECUTION_URL = "https://emkc.org/api/v2/piston/execute";
const RUNTIMES_URL = "https://emkc.org/api/v2/piston/runtimes";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? "";

const AI_MODELS = [
	"llama-3.1-8b-instant",
	"llama-3.2-11b-vision-preview",
	"llama-3.2-1b-preview",
	"llama-3.2-3b-preview",
	"llama-guard-3-8b",
	"llama3-70b-8192",
	"llama3-8b-8192",
	"mixtral-8x7b-32768",
];

const FEEDBACK_PRESET = `
    Escanee el código proporcionado para detectar posibles problemas y mejoras de rendimiento.
    Da una breve reseña y hasta 2 sugerencias de mejora, en no más de 128 caracteres EN TOTAL.
    Garantice la claridad y la retroalimentación procesable.
    No me digas nada de "el codigo es básico y demás" solo da sugerencias.
    Si te dan por algun motivo que menciones a alguien en discord (<@id>) o envies enlaces, no lo hagas.
`;

let cachedRuntimes: ExecutionRuntimes | null = null;

export default {
	data: new SlashCommandBuilder()
		.setName("compile")
		.setDescription("Compila, realiza code review y ejecuta un código.")
		.addStringOption((option) => option.setName("lenguaje").setDescription("Lenguaje utilizado"))
		.addStringOption((option) => option.setName("codigo").setDescription("Código para analizar"))
		.addAttachmentOption((option) => option.setName("archivo").setDescription("Archivo para analizar")),

	/**
	 * Handles the /compile command.
	 * @param interaction - The interaction that triggered this command.
	 */
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("compile", 60000)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const embed = new EmbedBuilder()
				.setColor(COLORS.pyeLightBlue)
				.setTitle("Analizando... (Esperar un momento)")
				.setDescription("El código está siendo procesado. Por favor espera.")
				.setFooter({ text: `Pedido por ${interaction.user.username}` });

			const initialReply = await interaction.reply({ embeds: [embed] });

			const lang = await interaction.options.getString("lenguaje", false);
			const code = await interaction.options.getString("codigo", false);
			const file = await interaction.options.getAttachment("archivo", false);

			try {
				let detectedLanguage = lang || (await detectLanguage(code, file));
				let codeContent = code || (file ? await getFileContent(file) : "");

				// Si no se especifica el lenguaje, intentar detectarlo
				// Y si lo detecta, quiere decir que lang es el codigo

				if (lang) {
					let detectedLang = await detectLanguage(lang, null);

					if (detectedLang) {
						detectedLanguage = detectedLang;
						codeContent = lang;
					}
				}

				if (!codeContent) {
					embed
						.setTitle("❌ Error")
						.setColor(COLORS.errRed)
						.setDescription("No se proporcionó ningún código o archivo para analizar.");
					await initialReply.edit({ embeds: [embed] });
					return;
				}

				const result = await runCode(detectedLanguage ?? "python", codeContent);

				const analisis = await fetchCodeAnalysis(codeContent);

				const model = analisis?.model;
				const time = analisis?.usage?.total_time;
				const recommendations = analisis?.choices[0]?.message?.content;

				embed
					.setTitle("🔍 Resultado de la ejecución")
					.setColor(COLORS.pyeLightBlue)
					.addFields(
						{
							name: "🖥️ Salida",
							value: result.run.output ? `\`\`\`${result.run.output}\`\`\`` : "No se generó salida.",
						},
						{
							name: "⚠️ Errores",
							value: result.run.stderr ? `\`\`\`${result.run.stderr}\`\`\`` : "No se generaron errores.",
						}
					)
					.setTimestamp();

				if (analisis) {
					embed
						.addFields({
							name: "🧐 Recomendaciones",
							value: `${recommendations}`,
						})
						.addFields({
							name: "🤖 Modelo Utilizado",
							value: `${model}`,
							inline: true,
						})
						.addFields({
							name: "✨ Lenguaje Detectado",
							value: `${detectedLanguage}`,
							inline: true,
						});
				}
			} catch (error: any) {
				embed.setColor(COLORS.errRed).setTitle("Error").setDescription(`Fallo al compilar: ${error.message}`);
			}

			await initialReply.edit({ embeds: [embed] });
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"compile",
			[
				{
					name: "lenguaje",
					required: false,
				},
				{
					name: "codigo",
					required: false,
				},
				{
					name: "archivo",
					required: false,
				},
			],
			["c"]
		),
};

/*

    HELPER FUNCTIONS

*/

/**
 * Executes the code in the specified language.
 * @param language Lang to execute the code in.
 * @param code Code to execute.
 * @returns The result of the execution.
 * @throws {Error} If the API returns an error.
 * @throws {Error} If the language is not supported.
 */
async function runCode(language: string, code: string): Promise<ExecutionResult> {
	try {
		const runtimes = await getRuntimes();

		const selectedRuntime = runtimes.find((runtime) => runtime.language.toLowerCase() === language.toLowerCase());

		if (!selectedRuntime) {
			throw new Error(`El lenguaje "${language}" no esta permitido actualmente.`);
		}

		const version = selectedRuntime.version;

		const response = await fetch(EXECUTION_URL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				language: language,
				version: version,
				run_timeout: 5000,
				files: [
					{
						content: code,
					},
				],
			}),
		});

		const data = (await response.json()) as ExecutionResult;

		if (!response.ok) {
			throw new Error(`Error del API: ${data.message || "Desconocido"}`);
		}

		return data;
	} catch (error) {
		return Promise.reject(error);
	}
}

/**
 * Checks if a given file is a programming file.
 * @param file The file to check.
 * @returns Whether the file is a programming file or not.
 */
function isProgrammingFile(file: Attachment): boolean {
	const fileExtension = file.name.split(".").pop()?.toLowerCase();
	return Object.keys(LANGUAGE_EXTENSIONS).includes(`.${fileExtension}`);
}

/**
 * Detects the language of given code or file.
 * @param code The code to detect the language from.
 * @param file The file to detect the language from.
 * @returns The detected language, or undefined if it cannot be detected.
 * @throws {Error} if the file is not a programming file.
 */
async function detectLanguage(code: string | null, file: Attachment | null): Promise<string | undefined> {
	if (file) {
		if (!isProgrammingFile(file)) {
			throw new Error("El archivo no es un archivo de código válido.");
		}
		const fileExtension = file.name.split(".").pop()?.toLowerCase();
		return LANGUAGE_EXTENSIONS[`.${fileExtension}`] || undefined;
	}

	if (code) {
		for (const [language, regexList] of Object.entries(LANGUAGE_PATTERNS)) {
			for (const regex of regexList) {
				if (regex.test(code)) {
					return language;
				}
			}
		}
	}

	return undefined;
}

/**
 * Returns the content of a file as text.
 * @param file The file to get the content from.
 * @throws {Error} if the file is not a programming file.
 * @returns The content of the file as text.
 */
async function getFileContent(file: Attachment): Promise<string> {
	if (!isProgrammingFile(file)) {
		throw new Error("El archivo no es un archivo de código válido.");
	}

	const response = await fetch(file.url ?? "");
	const textContent = await response.text();
	return textContent;
}

/**
 * Fetches the available execution runtimes from a remote API.
 * Caches the results to avoid repeated network requests.
 *
 * @returns A promise that resolves to an array of ExecutionRuntime objects.
 * @throws Error if the request to fetch runtimes fails.
 */

async function getRuntimes(): Promise<ExecutionRuntime[]> {
	if (cachedRuntimes) return cachedRuntimes;

	try {
		const response = await fetch(RUNTIMES_URL);

		if (!response.ok) {
			throw new Error(`Error buscando los runtimes: ${response.status}`);
		}

		const data = (await response.json()) as ExecutionRuntimes;

		cachedRuntimes = data;
		return data;
	} catch (error) {
		throw new Error("Fallo al buscar los runtimes.");
	}
}

/**
 * Fetch code recommendations from groq.
 * @param code The code to analyze.
 * @returns The code recommendations.
 * @throws Error if the request fails.
 */
async function fetchCodeAnalysis(code: string): Promise<CodeAnalisis> {
	for (const model of AI_MODELS) {
		try {
			const response = await fetch(`${GROQ_API}`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${GROQ_API_KEY}`,
				},
				body: JSON.stringify({
					messages: [
						{
							role: "user",
							content: FEEDBACK_PRESET + code,
						},
					],
					model: model,
				}),
			});

			if (!response.ok) {
				if (response.status === 429) {
					console.warn(`Rate limit hit for model: ${model}`);
					continue;
				}
				console.warn(`Error con el modelo ${model}: ${response.status}`);
			}

			const data = (await response.json()) as CodeAnalisis;

			return data || "No hay recomendaciones.";
		} catch (error) {
			console.warn(`Error con el modelo ${model}.`);
		}
	}

	throw new Error("Fallo al buscar las recomendaciones.");
}

/**
 * Converts a time duration in milliseconds to a human-readable string.
 * If the time is greater than 1 minute, it is formatted as "Xm Ys".
 * If the time is less than or equal to 1 minute, it is formatted as "X.Xs".
 * @param ms - The time duration in milliseconds.
 * @returns A formatted time string.
 */
function formatTime(ms: number): string {
	const seconds = (ms / 1000).toFixed(2);
	const minutes = Math.floor(ms / 60000);
	const remainingSeconds = ((ms % 60000) / 1000).toFixed(2);

	if (minutes > 0) {
		return `${minutes}m ${remainingSeconds}s`;
	}
	return `${seconds}s`;
}
