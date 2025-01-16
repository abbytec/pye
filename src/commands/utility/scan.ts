import { SlashCommandBuilder, EmbedBuilder, Attachment } from "discord.js";
import fetch from "node-fetch";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { COLORS } from "../../utils/constants.js";
import loadEnvVariables from "../../utils/environment.js";
import { VirusTotalScanResult, VirusTotalAnalysisResult } from "../../interfaces/IVirusTotal.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { PostHandleable } from "../../types/middleware.js";

loadEnvVariables();

const VIRUSTOTAL_API_KEY = process.env.VIRUSTOTAL_API_KEY ?? "";
const VIRUSTOTAL_URL = "https://www.virustotal.com/api/v3";

export default {
  data: new SlashCommandBuilder()
    .setName("scan")
    .setDescription("Analiza en búsqueda de virus")
    .addStringOption((option) =>
      option
        .setName("url")
        .setDescription("Enlace para analizar")
    )
    .addAttachmentOption((option) =>
      option
        .setName("archivo")
        .setDescription("Archivo para analizar")
    ),

  /**
   * Handles the /scan command.
   * @param interaction - The interaction that triggered this command.
   */
  execute: composeMiddlewares(
    [
      verifyIsGuild(process.env.GUILD_ID ?? "")
    ],
    async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
      const embed = new EmbedBuilder()
        .setColor(COLORS.pyeLightBlue)
        .setTitle("Analizando... (Esperar un momento)")
        .setDescription("El archivo o enlace está siendo procesado. Por favor espera.")
        .setFooter({ text: `Pedido por ${interaction.user.username}` });

      const initialReply = await interaction.reply({ embeds: [embed] });

      const urlToScan = await interaction.options.getString("url", false);
      const attachment = await interaction.options.getAttachment("archivo", false);

      try {
        let scanData: VirusTotalScanResult;

        if (attachment) {
          scanData = await scanFile(attachment);
        } else if (urlToScan && isValidUrl(urlToScan)) {
          scanData = await scanUrl(urlToScan);
        } else {
          throw new Error("No se proporcionó una entrada válida para escanear.");
        }

        const scanResult = await pollScanResults(scanData.data.id, 3, 10000);
        const analysisStats = scanResult.data.attributes.stats;
        const thumbnailUrl = getThumbnailUrl(analysisStats);

        const reportUrl = generateReportUrl(attachment, scanResult);
        embed
          .setTitle("🔍 Resultado del Escaneo")
          .setColor(COLORS.pyeLightBlue)
          .setThumbnail(thumbnailUrl)
          .setDescription(
            `🔗 **[Ver reporte en VirusTotal](${reportUrl})**\n` +
            `📊 **Total de Antivirus:** ${analysisStats.malicious + analysisStats.suspicious + analysisStats.harmless + analysisStats.undetected}\n` +
            `👀 **${attachment ? `ARCHIVO: ${attachment.name}` : `URL: [Click aquí](${scanResult.meta.url_info.url})`}**\n\n`
          )
          .addFields(
            {
              name: "🛑 Malicioso",
              value: `\`${analysisStats.malicious}\``,
              inline: true,
            },
            {
              name: "⚠️ Sospechoso",
              value: `\`${analysisStats.suspicious}\``,
              inline: true,
            },
            {
              name: "✅ Inofensivo",
              value: `\`${analysisStats.harmless + analysisStats.undetected}\``,
              inline: true,
            }
          )
          .setTimestamp();
      } catch (error: any) {
        embed
          .setColor(COLORS.errRed)
          .setTitle("Error")
          .setDescription(`Fallo al escanear: ${error.message}`);
      }

      await initialReply.edit({ embeds: [embed] });
    },
  ),
  prefixResolver: (client: ExtendedClient) => new PrefixChatInputCommand(client, "scan", 
    [
      {
        name: "url",
        required: false,
      },
      {
        name: "archivo",
        required: false,
      },
    ],
  ["sc"]),
};



/* 

    HELPER FUNCTIONS

*/



/**
 * Polls the VirusTotal API for scan results.
 * Retries until the analysis is complete or the maximum number of retries is reached.
 * @param scanId - The ID of the scan to fetch results for.
 * @param retries - The maximum number of retries.
 * @param delay - The delay (in ms) between retries.
 * @returns {Promise<VirusTotalAnalysisResult>} - The scan results.
 * @throws {Error} - Throws an error if the analysis is not complete after the retries.
 */
async function pollScanResults(scanId: string, retries: number, delay: number): Promise<VirusTotalAnalysisResult> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const scanResult = await fetchScanResults(scanId);
      
      if (!scanResult || !scanResult.data || !scanResult.data.attributes) {
        throw new Error("Invalid response from VirusTotal API.");
      }

      const stats = scanResult.data.attributes.stats;

      if (!stats || typeof stats.malicious === 'undefined' || typeof stats.suspicious === 'undefined' ||
        typeof stats.harmless === 'undefined' || typeof stats.undetected === 'undefined') {
        throw new Error("Incomplete scan stats data.");
      }

      const totalResults = stats.malicious + stats.suspicious + stats.harmless + stats.undetected;

      if (totalResults > 0) {
        return scanResult;
      }

      await new Promise((res) => setTimeout(res, delay));

    } catch (error: any) {
      if (attempt === retries - 1) {
        throw new Error("El análisis no se completó a tiempo. Intente nuevamente más tarde.");
      }
    }
  }

  throw new Error("El análisis no se completó a tiempo. Intente nuevamente más tarde.");
}

/**
 * Scans a file using the VirusTotal API by uploading the file as an attachment.
 * @param {Attachment} attachment - The file attachment to scan.
 * @returns {Promise<VirusTotalScanResult>} - A promise that resolves to the scan result.
 * @throws {Error} - Throws an error if the file scan fails.
 */
async function scanFile(attachment: Attachment): Promise<VirusTotalScanResult> {
  try {
    const fileBuffer = await fetch(attachment.url ?? "").then(res => res.arrayBuffer());

    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), "file");

    const response = await fetch(`${VIRUSTOTAL_URL}/files`, {
      method: "POST",
      headers: { "x-apikey": VIRUSTOTAL_API_KEY },
      body: formData,
    });

    if (!response.ok) throw new Error(`File scan failed: ${response.statusText}`);

    return (await response.json()) as VirusTotalScanResult;
  } catch (error: any) {
    throw new Error(`File scan error: ${error.message}`);
  }
}

/**
 * Scans a URL for potential threats using the VirusTotal API.
 *
 * @param {string} url - The URL to be scanned for viruses or malicious content.
 * @returns {Promise<VirusTotalScanResult>} - A promise that resolves to the scan result.
 * @throws {Error} - Throws an error if the URL scan fails or if the API request is unsuccessful.
 */

async function scanUrl(url: string): Promise<VirusTotalScanResult> {
  try {
    const response = await fetch(`${VIRUSTOTAL_URL}/urls`, {
      method: "POST",
      headers: {
        "x-apikey": VIRUSTOTAL_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ url }),
    });

    if (!response.ok) throw new Error(`URL scan failed: ${response.statusText}`);
    return (await response.json()) as VirusTotalScanResult;
  } catch (error: any) {
    throw new Error(`URL scan error: ${error.message}`);
  }
}

/**
 * Fetches the scan results for the given scan ID using the VirusTotal API.
 * @param {string} scanId - The ID of the scan to fetch the results for.
 * @returns {Promise<VirusTotalAnalysisResult>} - A promise that resolves to the scan results.
 * @throws {Error} - Throws an error if the scan results could not be fetched.
 */
async function fetchScanResults(scanId: string): Promise<VirusTotalAnalysisResult> {
  try {
    const response = await fetch(`${VIRUSTOTAL_URL}/analyses/${scanId}`, {
      headers: {
        "x-apikey": VIRUSTOTAL_API_KEY,
      },
    });

    if (!response.ok) throw new Error(`Failed to fetch scan results: ${response.statusText}`);
    return (await response.json()) as VirusTotalAnalysisResult;
  } catch (error: any) {
    throw new Error(`Error fetching scan results: ${error.message}`);
  }
}

/**
 * Returns the URL of a thumbnail image representing the scan result's safety.
 * If the scan result is malicious, returns a virus image.
 * If the scan result is suspicious, returns a warning image.
 * If the scan result is secure, returns a secure image.
 * @param {any} analysisStats - The analysis stats returned by VirusTotal.
 * @returns {string} - The URL of the thumbnail image.
 */
function getThumbnailUrl(analysisStats: any): string {
  if (analysisStats.malicious > 5) {
    return "https://cdn.discordapp.com/attachments/841469640956837908/1328482870435778600/virus.png";
  } else if (analysisStats.suspicious > 5 || analysisStats.malicious > 0) {
    return "https://cdn.discordapp.com/attachments/841469640956837908/1328482870028669080/warning.png";
  } else {
    return "https://cdn.discordapp.com/attachments/841469640956837908/1328482869550649385/secure.png";
  }
}

/**
 * Generates a URL to the VirusTotal report for the given scan result.
 * If the attachment is a file, the URL will be a file report.
 * If the attachment is a URL, the URL will be a URL report.
 * @param {Attachment | null} attachment - The attachment to generate the report URL for.
 * @param {VirusTotalAnalysisResult} scanResult - The scan result to generate the report URL for.
 * @returns {string} - The URL of the VirusTotal report.
 */
function generateReportUrl(attachment: Attachment | null, scanResult: VirusTotalAnalysisResult): string {
  const isFile = attachment !== null;
  return `https://www.virustotal.com/gui/${isFile ? 'file' : 'url'}/${isFile ? scanResult.meta.file_info.sha256 : scanResult.meta.url_info.id}`;
}

/**
 * Validates if a string is a properly formatted URL.
 * @param url - The string to validate.
 * @returns {boolean} - True if the string is a valid URL, false otherwise.
 */
function isValidUrl(url: string): boolean {
  const urlPattern = /^(https?:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[^\s]*)?$/;
  return urlPattern.test(url);
}