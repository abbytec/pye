import { SlashCommandBuilder, EmbedBuilder, Attachment } from "discord.js";
import fetch from "node-fetch";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { COLORS } from "../../utils/constants.js";
import loadEnvVariables from "../../utils/environment.js";
import { VirusTotalScanResult, VirusTotalAnalysisResult } from "../../interfaces/IVirusTotal.js";

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
  async execute(interaction: IPrefixChatInputCommand) {
    const input = await interaction.options.getString("url", false);
    const attachment = await interaction.options.getAttachment("archivo", false);

    const embed = new EmbedBuilder()
      .setColor(COLORS.pyeLightBlue)
      .setTitle("Analizando... (Esperar un momento)")
      .setDescription("El archivo o enlace está siendo procesado. Por favor espera.")
      .setFooter({ text: `Pedido por ${interaction.user.username}` });

    const initialReply = await interaction.reply({ embeds: [embed] });

    try {
      let scanData: VirusTotalScanResult;

      if (attachment) {
        scanData = await scanFile(attachment);
      } else if (input && input.startsWith("http://") || input.startsWith("https://")) {
        scanData = await scanUrl(input ?? "");
      } else {
        throw new Error("No valid input provided for scanning.");
      }

      await new Promise(f => setTimeout(f, 5000));

      const scanResult = await fetchScanResults(scanData.data.id);
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
          `👀 **${attachment ? `ARCHIVO: ${attachment?.name}` : `URL: [Click aquí](${scanResult.meta.url_info.url})`}**\n\n`
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
};



/* 

    HELPER FUNCTIONS

*/



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