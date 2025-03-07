import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { PostHandleable } from "../../types/middleware.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { replyError } from "../../utils/messages/replyError.js";
import { ICustomCommand } from "../../interfaces/ICustomCommand.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export const ruleData: ICustomCommand[] = [
	{
		name: "r1",
		embeds: [
			{
				title: "1. Discord Guidelines",
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
				title: "2. No contenido NSFW",
				color: COLORS.pyeLightBlue,
				description: "El contenido NSFW explícito **(+18) o muy sugestivo** no está permitido.",
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
				title: "3. Anti piratería/hacking",
				color: COLORS.pyeLightBlue,
				description:
					"Esta comunidad no promueve ni ninguna práctica ilegal, como piratería o hacking, sin embargo actividades educativas relacionadas al hacking ético (pentesting o ciberseguridad) pueden desarrollarse con normalidad.",
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
				title: "4. Respeto",
				color: COLORS.pyeLightBlue,
				description:
					"No acosar o incomodar a otros usuarios mediante pings, mensajes privados sin su consentimiento o faltando el respeto (ya sea en canales de texto o de voz).",
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
				title: "5. No desvirtuar canales",
				color: COLORS.pyeLightBlue,
				description: `Está PROHIBIDO desvirtuar los canales. Haz tus preguntas en un solo canal y NO preguntes si hay alguien disponible, directamente coloca tu problema a resolver.\nRevisa [Explorar canales](https://discord.com/channels/${
					process.env.GUILD_ID
				}/channel-browser) y si no encuentras un canal adecuado para tu duda, entonces publica en ⁠<#${getChannelFromEnv(
					"ayuda-general"
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
				title: "6. No floodear",
				color: COLORS.pyeLightBlue,
				description: `Solo se permite flood de videos e imágenes y en el canal de memes ⁠<#${getChannelFromEnv(
					"memes"
				)}> \nEl uso muy excesivo de comandos de bots al punto de molestar a otros usuarios debe ir en <#1094819492082745575>`,
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
				title: "7. Auto-promoción",
				color: COLORS.pyeLightBlue,
				description: `Solo se permite auto-promoción de contenido relacionado a la programación o tecnologías informáticas y solo está permitido en <#${getChannelFromEnv(
					"chatProgramadores"
				)}>.`,
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
				title: "8. No spam de trabajos",
				color: COLORS.pyeLightBlue,
				description: `Los mensajes en los canales de ⁠⁠<#${getChannelFromEnv("ofertasDeEmpleos")}>, ⁠⁠<#${getChannelFromEnv(
					"ofreceServicios"
				)}> y ⁠⁠<#${getChannelFromEnv(
					"proyectosNoPagos"
				)}> deben enviarse con una semana de diferencia.\nTampoco se permite eliminar el mensaje anterior para publicar uno nuevo.`,
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
				title: "9. No se resuelven tareas escolares",
				color: COLORS.pyeLightBlue,
				description:
					"**NO** se resuelven tareas escolares, bajo ninguna circunstancia debes subir un ejercicio y pedir que lo resuelvan. Pero puedes pedir ayuda para llegar a la resolución de tu problema.",
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
				title: "10. Sentido común",
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
					url: "https://cdn.discordapp.com/attachments/768329192131526686/1325228149428060251/images_2.jpg?ex=677b0664&is=6779b4e4&hm=5c884b1613dc9e4a1d185016a9ac4020bc4d302f1fcb379a963cce729d19e473&",
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
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
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
} as Command;
