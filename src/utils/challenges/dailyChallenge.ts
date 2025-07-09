import { ChannelType, EmbedBuilder, ThreadAutoArchiveDuration } from "discord.js";
import { ExtendedClient } from "../../client.js";
import { COLORS, getChannelFromEnv } from "../constants.js";
import { htmlToMarkdown } from "../html2mdparser.js";

const colorMap: Record<string, number> = {
	Easy: COLORS.okGreen, // verde
	Medium: COLORS.warnOrange, // naranja
	Hard: COLORS.errRed, // rojo
};

export async function getDailyChallenge(client: ExtendedClient) {
	try {
		// 1. Obtener el reto del día
		const res = await fetch("https://leetcode-api-pied.vercel.app/daily");
		const json = (await res.json()) as any;
		// La estructura suele ser algo como { date, question: { title, titleSlug, difficulty, content } }
		const { title, titleSlug, difficulty, content } = json.question;
		const mdContent = htmlToMarkdown(content);
		// 2. Construir el embed
		const embed = new EmbedBuilder()
			.setTitle(`🗓️ LeetCode Daily Challenge — ${title}`)
			.setURL(`https://leetcode.com/problems/${titleSlug}`)
			.addFields(
				{ name: "Dificultad", value: difficulty, inline: true },
				{ name: "Enlace", value: `[Ver en LeetCode](https://leetcode.com/problems/${titleSlug})`, inline: true }
			)
			.setDescription((await translateExceptCode(mdContent)).slice(0, 2048))
			.setFooter({ text: `Reto para ${json.date}` })
			.setColor(colorMap[difficulty] ?? COLORS.pyeLightBlue);

		// 3. Enviar al canal de retos
		const channel = await client.channels.fetch(getChannelFromEnv("retos"));
		if (channel?.type === ChannelType.GuildForum) {
			// crear un nuevo hilo (post) en el foro
			await channel.threads.create({
				name: `🗓️ Reto — ${title}`,
				appliedTags: ["1368739710876258344"],
				autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
				reason: "Daily LeetCode Challenge",
				message: { embeds: [embed], content: "Nuevo reto!!!" },
			});
		}
	} catch (err) {
		console.error("Error posteando Daily Challenge:", err);
	}
}

async function translateExceptCode(markdown: string, source = "en", target = "es") {
	// ➊ Partimos por bloques de código **y** preservamos los \n como tokens propios
	const parts = markdown.split(
		/(```[\s\S]*?```|`[^`]*`|\n)/g // ← añadimos |\n
	);

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];

		// ➋ Saltamos bloques de código **o** saltos de línea puros
		if (part === "\n" || /^```[\s\S]*```$/.test(part) || /^`[^`]*`$/.test(part)) {
			continue;
		}

		if (!part.trim()) continue; // nada que traducir

		try {
			const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(
				part
			)}`;
			const res = await fetch(url);
			const data = (await res.json()) as any;

			// ➌ Recuperamos los espacios/saltos originales
			const leading = RegExp(/^\s*/).exec(part)![0];
			const trailing = RegExp(/\s*$/).exec(part)![0];

			const translated = data[0].map((item: string[]) => item[0]).join("");
			parts[i] = leading + translated + trailing;
		} catch {
			parts[i] = part; // deja original si falla
		}
	}

	return parts.join("");
}
