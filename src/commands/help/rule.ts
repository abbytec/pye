import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ICustomCommand } from "../../interfaces/ICustomCommand.ts";
import { COLORS } from "../../utils/constants.ts";

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
						value: "<#845314420494434355>",
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
						value: "<#845314420494434355>",
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
						value: "<#845314420494434355>",
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
						value: "<#845314420494434355>",
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
				description:
					"Está PROHIBIDO desvirtuar los canales de temas específicos. Entendemos que pueden haber pequeñas desviaciones del tópico principal del canal, pero cuando esto se vuelve una acción habitual o se hacen comentarios con el claro motivo de generar controversía o discusiones que no se relacionan a la tématica del canal se aplicará sanción.\nHay un chat para hablar de cualquier cosa, sin ninguna restricción y es <#768329192131526686>",
				thumbnail: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/1004211341134942319/925047.png",
				},
				fields: [
					{
						name: "Recuerda leer",
						value: "<#845314420494434355>",
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
				description:
					"Haz tus preguntas en un solo canal y **NO** preguntes si hay alguien disponible, simplemente coloca tu problema a resolver. Si no sabes en cual canal debería ir entonces publica tu duda en ⁠<#1019686175490986124>",
				fields: [
					{
						name: "Recuerda leer",
						value: "<#845314420494434355>",
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
				description:
					"El flood de memes e imágenes sólo está permitido en <#783188322087993346>\nEl uso de los bots del servidor está permitido en varios canales, sin embargo el floodeo excesivo de comandos al punto de llegar a molestar a otros usuarios puede ser motivo de sanción.",
				thumbnail: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/1004211341134942319/925047.png",
				},
				fields: [
					{
						name: "Recuerda leer",
						value: "<#845314420494434355>",
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
				description: "El spam y la autopromoción SOLO está permitido en el canal de ⁠<#924436818718494740>",
				fields: [
					{
						name: "Recuerda leer",
						value: "<#845314420494434355>",
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
						value: "<#845314420494434355>",
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
				description: "Sentido común: si alguien te dice que te detengas es porque estás haciendo algo mal.",
				fields: [
					{
						name: "Recuerda leer",
						value: "<#845314420494434355>",
					},
				],
			},
		],
	},
	{
		name: "r11",
		embeds: [
			{
				title: "Regla 11°",
				color: COLORS.pyeLightBlue,
				description:
					"No preguntes si hay alguien disponible para ayudarte sin siquiera poner cuál es tu problema. Directamente pon tu problema a resolver mostrando toda la información necesaria.",
				thumbnail: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/1004211341134942319/925047.png",
				},
				fields: [
					{
						name: "Recuerda leer",
						value: "<#845314420494434355>",
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
	data: new SlashCommandBuilder()
		.setName("rule")
		.setDescription("Muestra preguntas frecuentes.")
		.addIntegerOption((option) =>
			option
				.setName("numero")
				.setDescription("El tema de la FAQ")
				.setRequired(true)
				.addChoices(...ruleData.map((rule) => ({ name: rule.embeds[0].title ?? "", value: Number(rule.name.slice(1)) })))
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const tema = interaction.options.getInteger("numero", true);
			const ruleEntry = ruleData.find((rule) => Number(rule.name.slice(1)) === tema);

			if (!ruleEntry) {
				return await replyError(interaction, "No se encontró esa regla.");
			}

			try {
				await (interaction.channel as TextChannel).send({ embeds: ruleEntry.embeds });
			} catch (error) {
				console.error("Error procesando el comando rule:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}
		}
	),
};
