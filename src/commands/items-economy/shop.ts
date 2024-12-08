// src/commands/Currency/shop.ts
import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	Message,
	Interaction,
} from "discord.js";
import { Shop } from "../../Models/Shop.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

const ITEMS_PER_PAGE = 10;

// Definición de los textos de respuesta (si es necesario)
const texts: string[] = [
	"Explora nuestra tienda y encuentra los mejores artículos para ti.",
	"¡Bienvenido a la tienda! Aquí puedes comprar y mejorar tus artículos.",
	"Echa un vistazo a nuestros productos exclusivos.",
	// Agrega más textos si lo deseas
];

export default {
	group: "📚 - Inventario (Casino)",
	data: new SlashCommandBuilder()
		.setName("shop")
		.setDescription("Muestra los artículos actuales en la tienda.")
		.addIntegerOption((option) => option.setName("pagina").setDescription("Número de página para ver los artículos.").setRequired(false)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener la página solicitada, por defecto 1
			let page = interaction.options.getInteger("pagina") ?? 1;
			page = Math.max(page, 1); // Asegurarse de que la página sea al menos 1

			const totalItems = await Shop.countDocuments();
			const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
			page = Math.min(page, totalPages); // Asegurarse de que la página no exceda el total

			const items = await Shop.find({}, "name price description itemId icon")
				.sort({ price: 1 })
				.skip((page - 1) * ITEMS_PER_PAGE)
				.limit(ITEMS_PER_PAGE)
				.lean();
			if (items.length === 0) {
				return await replyError(interaction, "No hay artículos disponibles en la tienda en este momento.");
			}

			// Crear embed de la tienda
			const embed = new EmbedBuilder()
				.setAuthor({
					name: "Tienda de Programadores y Estudiantes",
					iconURL: interaction.client.user?.displayAvatarURL() || "",
				})
				.setDescription(`Compra un ítem con el comando \`/buy [nombre del ítem]\`.\nÚsalos con el comando \`/use [nombre del ítem]\`.`)
				.addFields(
					items.map((item, index) => ({
						name: `\`${(page - 1) * ITEMS_PER_PAGE + index + 1}\`. ${item.icon ? item.icon + " " : ""}${
							item.name
						} \`[ID ${item.itemId.toString().padStart(2, "0")}]\` — 💰 ${item.price.toLocaleString()}`,
						value: item.description,
					}))
				)
				.setFooter({ text: `Página ${page}/${totalPages}` })
				.setColor(COLORS.pyeLightBlue)
				.setTimestamp();

			// Crear botones de paginación
			const backButton = new ButtonBuilder()
				.setStyle(ButtonStyle.Primary)
				.setLabel("«")
				.setCustomId("shopBack")
				.setDisabled(page === 1);

			const nextButton = new ButtonBuilder()
				.setStyle(ButtonStyle.Primary)
				.setLabel("»")
				.setCustomId("shopNext")
				.setDisabled(page === totalPages);

			const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, nextButton);

			// Enviar la respuesta inicial
			await replyOk(interaction, [embed], undefined, [actionRow], undefined, undefined, false);

			// Obtener el mensaje enviado
			const message = await interaction.fetchReply();

			// Asegurarse de que el mensaje es de tipo Message
			if (!(message instanceof Message)) {
				console.error("El mensaje obtenido no es una instancia de Message.");
				return;
			}

			// Crear un collector para manejar las interacciones de los botones
			const collector = message.createMessageComponentCollector({
				// Verificar que la interacción sea un botón y que tenga un customId válido
				filter: (i: Interaction) => i.isButton() && i.user.id === user.id && ["shopNext", "shopBack"].includes(i.customId),
				time: 60000, // 60 segundos
			});

			collector.on("collect", async (i) => {
				if (!i.isButton()) return;

				if (i.customId === "shopBack" && page > 1) {
					page--;
				} else if (i.customId === "shopNext" && page < totalPages) {
					page++;
				} else {
					await i.deferUpdate();
					return;
				}

				// Re-fetch items para la nueva página
				const newItems = await Shop.find({}, "name price description itemId icon")
					.sort({ price: 1 })
					.skip((page - 1) * ITEMS_PER_PAGE)
					.limit(ITEMS_PER_PAGE)
					.lean();
				// Actualizar embed
				const newEmbed = new EmbedBuilder()
					.setAuthor({
						name: "Tienda de Programadores y Estudiantes",
						iconURL: interaction.client.user?.displayAvatarURL() || "",
					})
					.setDescription(
						`Compra un ítem con el comando \`/buy [nombre del ítem]\`.\nÚsalos con el comando \`/use [nombre del ítem]\`.`
					)
					.addFields(
						newItems.map((item, index) => ({
							name: `\`${(page - 1) * ITEMS_PER_PAGE + index + 1}\`. ${item.icon} ${item.name} \`[ID ${item.itemId
								.toString()
								.padStart(2, "0")}]\` — 💰 ${item.price.toLocaleString()}`,
							value: item.description,
						}))
					)
					.setFooter({ text: `Página ${page}/${totalPages}` })
					.setColor(COLORS.pyeLightBlue)
					.setTimestamp();

				// Actualizar botones
				backButton.setDisabled(page === 1);
				nextButton.setDisabled(page === totalPages);
				const newActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, nextButton);

				await i.update({
					embeds: [newEmbed],
					components: [newActionRow],
				});
			});

			collector.on("end", async () => {
				// Deshabilitar los botones al finalizar el collector
				const disabledBackButton = ButtonBuilder.from(backButton).setDisabled(true);
				const disabledNextButton = ButtonBuilder.from(nextButton).setDisabled(true);
				const disabledActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledBackButton, disabledNextButton);

				await message
					.edit({
						components: [disabledActionRow],
					})
					.catch(() => null);
			});
		},
		[]
	),
} as Command;
