// src/commands/Currency/inventory.ts
import {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	GuildMember,
	Interaction,
	ButtonInteraction,
} from "discord.js";
import { getOrCreateUser, IUserModel } from "../../Models/User.js"; // Asegúrate de tener este modelo correctamente definido
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { IShopDocument, Shop } from "../../Models/Shop.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";

const ITEMS_PER_PAGE = 10;

export default {
	group: "📚 - Inventario (Casino)",
	data: new SlashCommandBuilder()
		.setName("inventory")
		.setDescription("Muestra los ítems que posees en tu inventario o el de otro usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Usuario cuyo inventario deseas ver.").setRequired(false))
		.addIntegerOption((option) => option.setName("pagina").setDescription("Número de página para ver los ítems.").setRequired(false)),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")), // Asegúrate de definir esta función o eliminar si no es necesaria
			deferInteraction(false),
		],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;
			const memberOption = await interaction.options.getUser("usuario");
			const pageOption = interaction.options.getInteger("pagina");

			// Determinar el miembro cuyo inventario mostrar
			let member: GuildMember;
			if (memberOption) {
				const fetchedMember = await interaction.guild?.members.fetch(memberOption.id).catch(() => null);
				if (!fetchedMember) return await replyError(interaction, "No se pudo encontrar al usuario especificado en este servidor.");
				member = fetchedMember;
			} else member = interaction.member as GuildMember;

			// Determinar la página a mostrar
			let page = pageOption && pageOption > 0 ? pageOption : 1;

			// Obtener los datos del usuario
			const userData: IUserModel = await getOrCreateUser(member.id);

			// Procesar los ítems del inventario
			const itemsWithQuantity = await getItems(userData);
			const totalPages = Math.ceil(itemsWithQuantity.length / ITEMS_PER_PAGE) || 1;

			// Ajustar la página si excede el total
			if (page > totalPages) page = totalPages;

			// Obtener los ítems para la página actual
			const paginatedItems = itemsWithQuantity.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

			// Crear el embed para el inventario
			const embed = new EmbedBuilder()
				.setAuthor({
					name: member.id === user.id ? "Tu inventario" : `Inventario de ${member.user.tag}`,
					iconURL: member.user.displayAvatarURL(),
				})
				.setDescription(`Puedes consumir un ítem escribiendo \`/use <nombre del ítem>\`.`)
				.addFields([
					{
						name: "Lista de ítems",
						value:
							paginatedItems.length > 0
								? paginatedItems
										.map(
											([item, amount], index) =>
												`\`${(page - 1) * ITEMS_PER_PAGE + index + 1}\`. ${item.icon ? item.icon + " " : ""}**${
													item.name
												}** (x${amount})\n\`[ID ${item.itemId}]\``
										)
										.join("\n")
								: "No tiene ningún ítem aún.",
					},
				])
				.setFooter({ text: `Página ${page}/${totalPages}` })
				.setColor(COLORS.pyeLightBlue)
				.setTimestamp();

			// Crear los botones de paginación
			const backButton = new ButtonBuilder()
				.setStyle(ButtonStyle.Primary)
				.setLabel("«")
				.setCustomId("inventoryBack")
				.setDisabled(page === 1);

			const nextButton = new ButtonBuilder()
				.setStyle(ButtonStyle.Primary)
				.setLabel("»")
				.setCustomId("inventoryNext")
				.setDisabled(page === totalPages);

			const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, nextButton);

			// Enviar la respuesta inicial
			await replyOk(interaction, [embed], undefined, [actionRow], undefined, undefined, false);

			// Obtener el mensaje enviado
			const message = await interaction.fetchReply();

			// Asegurarse de que el mensaje es de tipo Message
			if (message && !("edit" in message)) {
				console.error("El mensaje obtenido no es una instancia de Message.");
				return;
			}

			// Crear un collector para manejar las interacciones de los botones
			const collector = message?.createMessageComponentCollector({
				filter: (i: Interaction) => i.isButton() && i.user.id === user.id && ["inventoryNext", "inventoryBack"].includes(i.customId),
				time: 60000, // 60 segundos
			});

			collector?.on("collect", async (i: ButtonInteraction) => {
				if (i.customId === "inventoryBack" && page > 1) page--;
				else if (i.customId === "inventoryNext" && page < totalPages) page++;
				else {
					await i.deferUpdate();
					return;
				}

				// Obtener los ítems para la nueva página
				const updatedPaginatedItems = itemsWithQuantity.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

				// Crear el nuevo embed actualizado
				const updatedEmbed = new EmbedBuilder()
					.setAuthor({
						name: member.id === user.id ? "Tu inventario" : `Inventario de ${member.user.tag}`,
						iconURL: member.user.displayAvatarURL(),
					})
					.setDescription(`Puedes consumir un ítem escribiendo \`/use <nombre del ítem>\`.`)
					.addFields([
						{
							name: "Lista de ítems",
							value:
								updatedPaginatedItems.length > 0
									? updatedPaginatedItems
											.map(
												([item, amount], index) =>
													`\`${(page - 1) * ITEMS_PER_PAGE + index + 1}\`. ${item.icon} **${
														item.name
													}** (x${amount})\n\`[ID ${item.itemId}]\``
											)
											.join("\n")
									: "No tiene ningún ítem aún.",
						},
					])
					.setFooter({ text: `Página ${page}/${totalPages}` })
					.setColor(COLORS.pyeLightBlue)
					.setTimestamp();

				// Actualizar los botones de paginación
				backButton.setDisabled(page === 1);
				nextButton.setDisabled(page === totalPages);
				const updatedActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, nextButton);

				// Actualizar el mensaje con el nuevo embed y botones
				await i.update({
					embeds: [updatedEmbed],
					components: [updatedActionRow],
				});
			});

			collector?.on("end", async () => {
				// Deshabilitar los botones al finalizar el collector
				const disabledBackButton = ButtonBuilder.from(backButton).setDisabled(true);
				const disabledNextButton = ButtonBuilder.from(nextButton).setDisabled(true);
				const disabledActionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledBackButton, disabledNextButton);

				await message
					?.edit({
						components: [disabledActionRow],
					})
					.catch(() => null);
			});
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"inventory",
			[
				{
					name: "usuario",
					required: false,
				},
				{
					name: "pagina",
					required: false,
				},
			],
			["inv"]
		),
} as Command;

// Función para procesar y agrupar los ítems del inventario
async function getItems(data: IUserModel): Promise<[IShopDocument, number][]> {
	const itemsMap: Map<string, [IShopDocument, number]> = new Map();

	if (!data?.inventory?.length) return [];

	for (const itemId of data.inventory) {
		// Asumiendo que `itemId` es una referencia al documento de `Shop`
		if (!itemId) continue;
		if (itemsMap.has(itemId.toString())) {
			itemsMap.get(itemId.toString())![1]++;
		} else {
			const item: IShopDocument | null = await Shop.findOne({ _id: itemId });
			if (!item) continue;
			itemsMap.set(item._id.toString(), [item, 1]);
		}
	}

	return Array.from(itemsMap.values());
}
