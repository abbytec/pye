import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { PostHandleable } from "../../types/middleware.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { replyError } from "../../utils/messages/replyError.js";
import { ICustomCommand } from "../../interfaces/ICustomCommand.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";

const ruleData: ICustomCommand[] = [
	{
		name: "r1",
		embeds: [
			{
				title: "Regla 1°",
				color: COLORS.pyeLightBlue,
				description: "Esta comunidad se rige principalmente bajo las directivas de Discord:\nhttps://discord.com/guidelines",
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r2",
		embeds: [
			{
				title: "Regla 2°",
				color: COLORS.pyeLightBlue,
				description: "El contenido NSFW explícito**(+18)** no está permitido.",
				thumbnail: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/1004211341134942319/925047.png",
				},
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r3",
		embeds: [
			{
				title: "Regla 3°",
				color: COLORS.pyeLightBlue,
				description:
					"Esta comunidad no promueve la piratería, ni ninguna práctica ilegal como el hacking, sin embargo actividades relacionadas al hacking ético pueden desarrollarse con normalidad.",
				thumbnail: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/1004211341134942319/925047.png",
				},
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r4",
		embeds: [
			{
				title: "Regla 4°",
				color: COLORS.pyeLightBlue,
				description:
					"No acosar a otros usuarios mediante pings para que resuelvan tus dudas.\nTampoco debes mandar mensajes privados a otro usuario sin su consentimiento previo.",
				thumbnail: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/1004211341134942319/925047.png",
				},
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r5",
		embeds: [
			{
				title: "Regla 5°",
				color: COLORS.pyeLightBlue,
				description: `Está PROHIBIDO desvirtuar los canales de temas específicos. Entendemos que pueden haber pequeñas desviaciones del tópico principal del canal, pero cuando esto se vuelve una acción habitual o se hacen comentarios con el claro motivo de generar controversía o discusiones que no se relacionan a la tématica del canal se aplicará sanción.\nHay un chat para hablar de cualquier cosa, sin ninguna restricción y es <#${getChannelFromEnv(
					"general"
				)}>`,
				thumbnail: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/1004211341134942319/925047.png",
				},
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r6",
		embeds: [
			{
				title: "Regla 6°",
				color: COLORS.pyeLightBlue,
				description: `Haz tus preguntas en un solo canal y **NO** preguntes si hay alguien disponible, simplemente coloca tu pregunta o problema a resolver aclarando toda la información necesaria. Si no sabes en cual canal debería ir entonces publica tu duda en ⁠<#${getChannelFromEnv(
					"ayuda-general"
				)}>`,
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r7",
		embeds: [
			{
				title: "Regla 7°",
				color: COLORS.pyeLightBlue,
				description: `El flood de memes e imágenes sólo está permitido en <#${getChannelFromEnv(
					"memes"
				)}>\nEl uso de los bots del servidor está permitido en varios canales, sin embargo el floodeo excesivo de comandos al punto de llegar a molestar a otros usuarios puede ser motivo de sanción, si queres utliarlos con tanta frecuencia, existe el hilo <#1094819492082745575>.`,
				thumbnail: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/1004211341134942319/925047.png",
				},
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r8",
		embeds: [
			{
				title: "Regla 8°",
				color: COLORS.pyeLightBlue,
				description: `Solo se permite autopromoción de contenido relacionado a la programación o tecnologías informáticas y dicho contenido debe ir en ⁠<#${getChannelFromEnv(
					"chatProgramadores"
				)}>`,
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r9",
		embeds: [
			{
				title: "Regla 9°",
				color: COLORS.pyeLightBlue,
				description:
					"**NO** se resuelven tareas escolares, bajo ninguna circunstancia debes subir un ejercicio y pedir que lo resuelvan. Pero puedes pedir ayuda para llegar a la resolución de un enunciado.",
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r10",
		embeds: [
			{
				title: "Regla 10°",
				color: COLORS.pyeLightBlue,
				description: "Sentido común: Respeta a los demás, si alguien te dice que te detengas es porque estás haciendo algo mal.",
				fields: [
					{
						name: "Recuerda leer",
						value: `<#${getChannelFromEnv("reglas")}>`,
					},
				],
			},
		],
	},
	{
		name: "r34",
		embeds: [
			{
				title: "Regla 34°",
				color: COLORS.pyeLightBlue,
				description: "rule 34",
				image: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/974852573699911750/107755554_2112583655552478_7850237487263192075_n.jpg",
				},
			},
		],
	},
];

export default {
	group: "📜 - Ayuda",
	data: new SlashCommandBuilder()
		.setName("regla")
		.setDescription("Muestra preguntas frecuentes.")
		.addIntegerOption((option) =>
			option
				.setName("numero")
				.setDescription("La regla a mostrar.")
				.setRequired(true)
				.addChoices(...ruleData.map((rule) => ({ name: rule.embeds?.at(0)?.title ?? "", value: Number(rule.name.slice(1)) })))
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? "")],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const tema = interaction.options.getInteger("numero", true);
			const ruleEntry = ruleData.find((rule) => Number(rule.name.slice(1)) === tema);

			if (!ruleEntry) {
				return await replyError(interaction, "No se encontró esa regla.");
			}

			try {
				await interaction.reply({ embeds: ruleEntry.embeds });
			} catch (error) {
				console.error("Error procesando el comando regla:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}
		}
	),
};
