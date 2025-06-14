import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { COLORS } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { PostHandleable } from "../../types/middleware.js";
import os from "os";
import { execSync } from "child_process";

/**
 * Fetches VPS system info, including RAM, CPU, uptime, and disk usage.
 */
export default {
	group: "⚙️ - Administración - General",
	data: new SlashCommandBuilder()
		.setName("usage")
		.setDescription("Muestra información del servidor.")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff")],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const embed = new EmbedBuilder()
				.setColor(COLORS.pyeLightBlue)
				.setTitle("📊 Información del VPS")
				.setDescription("Mostrando el estado actual del servidor.")
				.setFooter({ text: `Pedido por ${interaction.user.username}` });

			try {
				// RAM Usage
				const totalRam = os.totalmem();
				const freeRam = os.freemem();
				const usedRam = totalRam - freeRam;
				const ramUsagePercent = ((usedRam / totalRam) * 100).toFixed(2);

				// CPU Usage
				const cpuUsagePercent = await getCpuUsage();
				const cpuModel = os.cpus()[0]?.model ?? "Desconocido";
				const cpuCores = os.cpus().length;

				// Uptime
				const uptime = formatTime(process.uptime() * 1000);

				// Disk Usage
				const diskUsage = getDiskUsage();

				embed.addFields(
					{
						name: "🖥️ CPU",
						value: `Modelo: **${cpuModel}**\nNúcleos: **${cpuCores}**\nUso: **${cpuUsagePercent}%**`,
						inline: true,
					},
					{
						name: "📊 RAM",
						value: `**${formatBytes(usedRam)}** / **${formatBytes(totalRam)}**\nUso: **${ramUsagePercent}%**`,
						inline: true,
					},
					{ name: "🕒 Tiempo de encendido (bot)", value: uptime, inline: true },
					{
						name: "💾 Disco",
						value: `Usado: **${diskUsage.used}** / **${diskUsage.total}**\nUso: **${diskUsage.percent}**`,
						inline: false,
					}
				);
			} catch (error: any) {
				embed.setColor(COLORS.errRed).setTitle("❌ Error").setDescription(`No se pudo obtener la información del VPS: ${error.message}`);
			}

			await interaction.reply({ embeds: [embed] });
		}
	),

	prefixResolver: (client: ExtendedClient) => new PrefixChatInputCommand(client, "usage", [], []),
};

/**
 * Gets CPU usage as a percentage.
 * @returns {Promise<number>} The CPU usage percentage.
 */
async function getCpuUsage(): Promise<number> {
	return new Promise((resolve) => {
		const start = os.cpus();

		setTimeout(() => {
			const end = os.cpus();
			let totalIdle = 0,
				totalTick = 0;

			for (let i = 0; i < start.length; i++) {
				const startCore = start[i];
				const endCore = end[i];

				const idle = endCore.times.idle - startCore.times.idle;
				const total =
					Object.values(endCore.times).reduce((a, b) => a + b, 0) - Object.values(startCore.times).reduce((a, b) => a + b, 0);

				totalIdle += idle;
				totalTick += total;
			}

			const cpuUsage = 100 - (100 * totalIdle) / totalTick;
			resolve(parseFloat(cpuUsage.toFixed(2)));
		}, 500);
	});
}

/**
 * Gets disk usage from the root directory.
 * @returns {Object} Disk usage stats.
 */
function getDiskUsage(): { total: string; used: string; percent: string } {
	try {
		let total = 0,
			used = 0,
			percent = "N/A";

		const output = execSync("df -k /").toString();
		const lines = output.trim().split("\n");
		const [_, totalBlocks, usedBlocks] = lines[1].split(/\s+/).map(Number);

		total = totalBlocks * 1024; // Convert KB to Bytes
		used = usedBlocks * 1024;

		percent = ((used / total) * 100).toFixed(2) + "%";
		return { total: formatBytes(total), used: formatBytes(used), percent };
	} catch (error) {
		return { total: "Desconocido", used: "Desconocido", percent: "N/A" };
	}
}

/**
 * Converts bytes to human-readable format.
 * @param bytes The number of bytes.
 * @returns A formatted string.
 */
function formatBytes(bytes: number): string {
	const sizes = ["B", "KB", "MB", "GB", "TB"];
	let i = 0;
	while (bytes >= 1024 && i < sizes.length - 1) {
		bytes /= 1024;
		i++;
	}
	return `${bytes.toFixed(2)} ${sizes[i]}`;
}

/**
 * Converts milliseconds to a human-readable time format.
 * @param ms Time in milliseconds.
 * @returns {string} Formatted time.
 */
function formatTime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(ms / 60000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
	if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	return `${seconds}s`;
}
