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
import { CodeAnalisis } from "../../interfaces/ICodeExecution.js";
import loadEnvVariables from "../../utils/environment.js";

loadEnvVariables();

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
    Analiza el siguiente código y proporciona:
    - Una breve reseña general (máx 1 línea)
    - Hasta 2 sugerencias de mejora (cada una de máx. 64 caracteres)

    Ejemplo de formato:
    Reseña: Usa buenas prácticas, pero puede optimizarse.
    1. Renombra variables para mayor claridad
    2. Evita lógica duplicada en funciones

    ⚠️ Restricciones:
    - No digas que el código es simple, básico o que está bien hecho.
    - No incluyas menciones de Discord (como <@123>) ni enlaces externos.
    - Responde solo con retroalimentación técnica y práctica.
    - Sé claro, conciso y útil.

    Código:
`;

export default {
    data: new SlashCommandBuilder()
        .setName("codereview")
        .setDescription("Realiza code review.")
        .addStringOption((option) => option.setName("codigo").setDescription("Código para analizar"))
        .addAttachmentOption((option) => option.setName("archivo").setDescription("Archivo para analizar")),

    /**
     * Handles the /codereview command.
     * @param interaction - The interaction that triggered this command.
     */
    execute: composeMiddlewares(
        [verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("codereview", 60000)],
        async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
            const embed = new EmbedBuilder()
                .setColor(COLORS.pyeLightBlue)
                .setTitle("Analizando... (Esperar un momento)")
                .setDescription("El código está siendo procesado. Por favor espera.")
                .setFooter({ text: `Pedido por ${interaction.user.username}` });

            const initialReply = await interaction.reply({ embeds: [embed] });

            let code = await interaction.options.getString("codigo", false);
            const file = await interaction.options.getAttachment("archivo", false);

            try {

                if(!code) {
                    const replied = await interaction.message?.fetchReference()?.then((message) => message.content);
                    code = replied ?? "";
                }

                let detectedLanguage = await detectLanguage(code, file);
                let codeContent = code || (file ? await getFileContent(file) : "");

                if (!codeContent) {
                    embed
                        .setTitle("❌ Error")
                        .setColor(COLORS.errRed)
                        .setDescription("No se proporcionó ningún código o archivo para analizar.");
                    await initialReply.edit({ embeds: [embed] });
                    return;
                }

                const analisis = await fetchCodeAnalysis(codeContent);

                const model = analisis?.model;
                const time = analisis?.usage?.total_time;
                const recommendations = analisis?.choices[0]?.message?.content;

                embed
                    .setTitle("📋 Revisión de Código")
                    .setColor(COLORS.okGreen)
                    .addFields(
                        {
                            name: "🧐 Recomendaciones",
                            value: recommendations?.slice(0, 1000) || "No se generaron recomendaciones.",
                        },
                        {
                            name: "💡 Lenguaje Detectado",
                            value: detectedLanguage || "Desconocido",
                            inline: true,
                        },
                        {
                            name: "🤖 Modelo Utilizado",
                            value: model || "N/A",
                            inline: true,
                        },
                        {
                            name: "⏱️ Tiempo de respuesta",
                            value: time ? `${time.toFixed(2)} ms` : "N/A",
                            inline: true,
                        }
                    )
                    .setFooter({ text: `Pedido por ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
                    .setTimestamp();
            } catch (error: any) {
                embed.setColor(COLORS.errRed).setTitle("Error").setDescription(`Fallo al revisar el código: ${error.message}`);
            }

            await initialReply.edit({ embeds: [embed] });
        }
    ),
    prefixResolver: (client: ExtendedClient) =>
        new PrefixChatInputCommand(
            client,
            "codereview",
            [
                {
                    name: "codigo",
                    required: false,
                },
                {
                    name: "archivo",
                    required: false,
                },
            ],
            ["cr"]
        ),
};

/*

    HELPER FUNCTIONS

*/

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