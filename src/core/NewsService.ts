import { TextChannel } from "discord.js";
import { CoreClient } from "./CoreClient.js";
import { getYesterdayUTC } from "../utils/generic.js";
import { createSimpleChatEmbed } from "../utils/ai/aiResponseService.js";

export class NewsService {
	constructor(private readonly client: CoreClient) {}

	async sendDailyNews(channel: TextChannel) {
		const start = getYesterdayUTC().toISOString();
		const apiKey = process.env.CURRENTS_API_KEY;
		if (!apiKey) {
			console.log("No se encontró la API key de CurrentsAPI.");
			return;
		}

		const url = `https://api.currentsapi.services/v1/search?apiKey=${apiKey}&language=es&category=technology&start_date=${start}`;
		try {
			const data = await fetch(url)
				.catch((e) => {
					console.error("Error al obtener las noticias:", e);
					return null;
				})
				.then(async (response) => {
					return (await response?.json()) as any;
				});

			if (!data.news || data.news.length === 0) {
				console.log("No se encontraron noticias. Data:", data);
				return;
			}

			// Filtrar las noticias para que solo sean de la categoría 'technology'
			// Suponiendo que 'category' es un array de strings en cada noticia
			const filteredNews = data.news.filter(
				(article: any) =>
					Array.isArray(article.category) && article.category.length === 1 && article.category[0].toLowerCase() === "technology"
			);

			if (filteredNews.length === 0) {
				console.log("No se encontraron noticias cuya única categoría sea 'technology'.");
				return;
			}

			const cleanDescription = (desc: string): string => desc.replace(/\s+/g, " ").trim();

			// Limitar a 5 noticias y formar los fields
			const newsFields = filteredNews.slice(0, 5).map((article: any) => ({
				name: article.title.substring(0, 256),
				value: `${article.description ? cleanDescription(article.description).substring(0, 1024) : "Sin descripción."} [ver más](${
					article.url
				})`,
			}));

			const embed = createSimpleChatEmbed("Holiis, aquí les traigo algunas noticias 😊❤️", newsFields);
			channel.send({ embeds: [embed] });
		} catch (error) {
			console.error("Error al procesar las noticias:", error);
		}
	}
}
