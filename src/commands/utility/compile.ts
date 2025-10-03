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
import { ExecutionResult, ExecutionRuntime, ExecutionRuntimes } from "../../interfaces/ICodeExecution.js";
import loadEnvVariables from "../../utils/environment.js";

loadEnvVariables();

const EXECUTION_URL = "https://emkc.org/api/v2/piston/execute";
const RUNTIMES_URL = "https://emkc.org/api/v2/piston/runtimes";

let cachedRuntimes: ExecutionRuntimes | null = null;

export default {
	data: new SlashCommandBuilder()
		.setName("compile")
		.setDescription("Compila y ejecuta un código.")
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

			const lang = interaction.options.getString("lenguaje", false);
			const code = interaction.options.getString("codigo", false);
			const file = await interaction.options.getAttachment("archivo", false);

			try {
				let detectedLanguage = lang || (await detectLanguage(code, file));
				let codeContent = code || (file ? await getFileContent(file) : "");

				// Si no se especifica el lenguaje, intentar detectarlo
				// Y si lo detecta, quiere decir que lang es el codigo

				if (lang) {
					const detectedLang = await detectLanguage(lang, null);

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
	} catch (error: any) {
		return Promise.reject(error as Error);
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
	} catch {
		throw new Error("Fallo al buscar los runtimes.");
	}
}
