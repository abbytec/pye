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
	AttachmentBuilder,
	Guild,
} from "discord.js";
import path, { dirname } from "node:path";
import { loadImage } from "@napi-rs/canvas";
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
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { getRender } from "../../utils/canvas/card-render.js";
import { fileURLToPath } from "url";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";

const ITEMS_PER_PAGE = 10;

const __dirname = dirname(fileURLToPath(import.meta.url));
export default {
	group: "📚 - Inventario (Casino)",
	data: new SlashCommandBuilder()
		.setName("shop")
		.setDescription("Muestra la tienda.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("items")
				.setDescription("Ver todos los artículos de la tienda.")
				.addIntegerOption((option) =>
					option.setName("pagina").setDescription("Número de página para ver los artículos.").setRequired(false)
				)
		)
		.addSubcommand((subcommand) => subcommand.setName("fondos").setDescription("Ver fondos disponibles.")),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")),
			verifyCooldown("shop", 20000),
			deferInteraction(false),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const subcommand = interaction.options.getSubcommand();

			// ----------------------------
			// Rama para mostrar ITEMS normales
			// ----------------------------
			if (subcommand === "items") {
				// Obtener la página solicitada, por defecto 1
				let page = interaction.options.getInteger("pagina") ?? 1;
				page = Math.max(page, 1);
				const filter = { $or: [{ background: { $exists: false } }, { background: null }] };
				const totalItems = await Shop.countDocuments(filter);
				const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
				page = Math.min(page, totalPages);

				const items = await Shop.find(filter, "name price description itemId icon")
					.sort({ price: 1 })
					.skip((page - 1) * ITEMS_PER_PAGE)
					.limit(ITEMS_PER_PAGE)
					.lean();
				if (items.length === 0) {
					return await replyError(interaction, "No hay artículos disponibles en la tienda en este momento.");
				}

				const embed = new EmbedBuilder()
					.setAuthor({
						name: "Tienda de Programadores y Estudiantes",
						iconURL: interaction.client.user?.displayAvatarURL() ?? "",
					})
					.setDescription(
						`Compra un ítem con el comando \`/buy [nombre del ítem]\`.\nÚsalos con el comando \`/use [nombre del ítem]\`.`
					)
					.addFields(
						items.map((item, index) => {
							item.price = ExtendedClient.getInflatedRate(item.price || 0);
							return {
								name: `\`${(page - 1) * ITEMS_PER_PAGE + index + 1}\`. ${item.icon ? item.icon + " " : ""}${
									item.name
								} \`[ID ${item.itemId.toString().padStart(2, "0")}]\` — 💰 ${item.price.toLocaleString()}`,
								value: item.description,
							};
						})
					)
					.setFooter({ text: `Página ${page}/${totalPages}` })
					.setColor(COLORS.pyeLightBlue)
					.setTimestamp();

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

				await replyOk(interaction, [embed], undefined, [actionRow], undefined, undefined, false);

				const message = await interaction.fetchReply();
				if (!(message instanceof Message)) {
					console.error("El mensaje obtenido no es una instancia de Message.");
					return;
				}

				const collector = message.createMessageComponentCollector({
					filter: (i: Interaction) =>
						i.isButton() && i.user.id === interaction.user.id && ["shopNext", "shopBack"].includes(i.customId),
					time: 60000,
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

					const newItems = await Shop.find(
						{ $or: [{ background: { $exists: false } }, { background: null }] },
						"name price description itemId icon"
					)
						.sort({ price: 1 })
						.skip((page - 1) * ITEMS_PER_PAGE)
						.limit(ITEMS_PER_PAGE)
						.lean();

					const newEmbed = new EmbedBuilder()
						.setAuthor({
							name: "Tienda de Programadores y Estudiantes",
							iconURL: interaction.client.user?.displayAvatarURL() || "",
						})
						.setDescription(
							`Compra un ítem con el comando \`/buy [nombre del ítem]\`.\nÚsalos con el comando \`/use [nombre del ítem]\`.`
						)
						.addFields(
							newItems.map((item, index) => {
								item.price = ExtendedClient.getInflatedRate(item.price || 0);
								return {
									name: `\`${(page - 1) * ITEMS_PER_PAGE + index + 1}\`. ${item.icon ? item.icon + " " : ""}${
										item.name
									} \`[ID ${item.itemId.toString().padStart(2, "0")}]\` — 💰 ${item.price.toLocaleString()}`,
									value: item.description,
								};
							})
						)
						.setFooter({ text: `Página ${page}/${totalPages}` })
						.setColor(COLORS.pyeLightBlue)
						.setTimestamp();

					backButton.setDisabled(page === 1);
					nextButton.setDisabled(page === totalPages);
					const newActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, nextButton);

					await i.update({
						embeds: [newEmbed],
						components: [newActionRow],
					});
				});

				collector.on("end", async () => {
					const disabledBackButton = ButtonBuilder.from(backButton).setDisabled(true);
					const disabledNextButton = ButtonBuilder.from(nextButton).setDisabled(true);
					const disabledActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledBackButton, disabledNextButton);
					await message.edit({ components: [disabledActionRow] }).catch(() => null);
				});

				return;
			}

			// ----------------------------
			// Rama para mostrar FONDOS (subcomando fondos)
			// ----------------------------
			if (subcommand === "fondos") {
				// Buscar únicamente los items que tienen la propiedad "background"
				const fondos = await Shop.find({ background: { $exists: true, $ne: null } }, "name price description itemId icon background")
					.sort({ price: 1 })
					.lean();
				if (fondos.length === 0) {
					return await replyError(interaction, "No hay fondos disponibles en la tienda en este momento.");
				}

				let index = 0;
				const totalFondos = fondos.length;

				// Función para generar la vista previa utilizando getRender
				async function generatePreview(idx: number) {
					const fondo = fondos[idx];
					const guildIcon = (interaction.guild as Guild).iconURL({ extension: "png", forceStatic: true }) ?? "";
					const customBackground = fondo.background; // nombre de imagen con extensión
					const avatar = await loadImage(guildIcon);
					const foreground = await loadImage(path.join(__dirname, `../../assets/Images/reputation/novato.png`));
					const backgroundPath = path.join(__dirname, `../../assets/Images/custom-backgrounds/${customBackground}`);
					const customBackgroundImage = await loadImage(backgroundPath);
					// Valores de ejemplo; se pueden ajustar según necesidad
					const imageBuffer = getRender({
						name: fondo.name,
						points: "0",
						rank: "1",
						avatar,
						foreground,
						pyeCoins: "0",
						role: null,
						customBackground: customBackgroundImage,
					});
					return { imageBuffer, fondo };
				}

				const { imageBuffer, fondo } = await generatePreview(index);

				const attachment = new AttachmentBuilder(imageBuffer.toBuffer("image/png"), { name: "preview.png" });

				const embed = new EmbedBuilder()
					.setTitle(`Fondo: ${fondo.name}`)
					.setDescription(
						(fondo.description || "") + "\n\n" + `💰 Precio: ${ExtendedClient.getInflatedRate(fondo.price).toLocaleString()}`
					)
					.setImage("attachment://preview.png")
					.setFooter({ text: `Fondo ${index + 1} de ${totalFondos}. ID: ${fondo.itemId}` })
					.setColor(COLORS.pyeLightBlue)
					.setTimestamp();

				const backButton = new ButtonBuilder()
					.setStyle(ButtonStyle.Primary)
					.setLabel("«")
					.setCustomId("fondosBack")
					.setDisabled(index === 0);

				const nextButton = new ButtonBuilder()
					.setStyle(ButtonStyle.Primary)
					.setLabel("»")
					.setCustomId("fondosNext")
					.setDisabled(totalFondos === 1);

				const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, nextButton);

				await replyOk(interaction, [embed], undefined, [actionRow], [attachment]);
				const message = await interaction.fetchReply();
				if (!(message instanceof Message)) {
					console.error("El mensaje obtenido no es una instancia de Message.");
					return;
				}

				const collector = message.createMessageComponentCollector({
					filter: (i: Interaction) =>
						i.isButton() && i.user.id === interaction.user.id && ["fondosBack", "fondosNext"].includes(i.customId),
					time: 60000,
				});

				collector.on("collect", async (i) => {
					if (!i.isButton()) return;
					if (i.customId === "fondosBack" && index > 0) {
						index--;
					} else if (i.customId === "fondosNext" && index < totalFondos - 1) {
						index++;
					} else {
						await i.deferUpdate();
						return;
					}

					const { imageBuffer, fondo } = await generatePreview(index);
					const attachment = new AttachmentBuilder(imageBuffer.toBuffer("image/png"), { name: "preview.png" });

					backButton.setDisabled(index === 0);
					nextButton.setDisabled(index === totalFondos - 1);
					const newActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, nextButton);

					const newEmbed = EmbedBuilder.from(embed)
						.setTitle(`Fondo: ${fondo.name}`)
						.setDescription(
							(fondo.description || "") + "\n\n" + `💰 Precio: ${ExtendedClient.getInflatedRate(fondo.price).toLocaleString()}`
						)
						.setImage("attachment://preview.png")
						.setFooter({ text: `Fondo ${index + 1} de ${totalFondos}` })
						.setTimestamp();

					await i.update({ embeds: [newEmbed], files: [attachment], components: [newActionRow] });
				});

				collector.on("end", async () => {
					const disabledRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
						ButtonBuilder.from(backButton).setDisabled(true),
						ButtonBuilder.from(nextButton).setDisabled(true)
					);
					await message.edit({ components: [disabledRow] });
				});
			}
		}
	),
	prefixResolver: (client: ExtendedClient) => new PrefixChatInputCommand(client, "shop", [], ["tienda"]),
} as Command;
