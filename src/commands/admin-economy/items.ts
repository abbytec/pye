// src/commands/admin/items.ts

import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	PermissionFlagsBits,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	StringSelectMenuBuilder,
	ComponentType,
	ButtonStyle,
	MessageActionRowComponentBuilder,
} from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { IShop, IShopDocument, Shop } from "../../Models/Shop.js";
import { replyError } from "../../utils/messages/replyError.js";
import ms from "ms";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

function getId(items: any[]): number {
	if (!items || items.length === 0) return 1;

	const itemIds = items.map((item) => parseInt(item.itemId));
	let id = 1;
	while (itemIds.includes(id)) {
		id++;
	}
	return id;
}

export default {
	group: "⚙️ - Administración de Economía",
	data: new SlashCommandBuilder()
		.setName("items")
		.setDescription("⚙️ - Administra ítems en la tienda.")
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.addSubcommand((subcommand) => subcommand.setName("visualizar").setDescription("Visualiza los ítems disponibles."))
		.addSubcommand((subcommand) =>
			subcommand
				.setName("añadir")
				.setDescription("Añade un nuevo ítem a la tienda.")
				.addStringOption((option) => option.setName("nombre").setDescription("Nombre del ítem.").setRequired(true))
				.addStringOption((option) => option.setName("descripcion").setDescription("Descripción del ítem.").setRequired(true))
				.addIntegerOption((option) => option.setName("precio").setDescription("Precio del ítem.").setRequired(true).setMinValue(0))
				.addBooleanOption((option) => option.setName("almacenable").setDescription("¿Es almacenable?").setRequired(true))
				.addStringOption((option) => option.setName("icono").setDescription("Icono del ítem.").setRequired(false))
				.addStringOption((option) => option.setName("mensaje").setDescription("Mensaje al usar el ítem.").setRequired(false))
				.addRoleOption((option) => option.setName("rol").setDescription("Rol a dar al usar el ítem.").setRequired(false))
				.addStringOption((option) => option.setName("grupo").setDescription("Grupo del ítem.").setRequired(false))
				.addStringOption((option) => option.setName("timeout").setDescription("Duración del rol (ejemplo: 1h, 30m).").setRequired(false))
				.addStringOption((option) =>
					option.setName("background").setDescription("Nombre de la imagen de fondo con extensión.").setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("editar")
				.setDescription("Edita un ítem existente.")
				.addStringOption((option) => option.setName("id").setDescription("Id del ítem a editar.").setRequired(true))
				.addStringOption((option) => option.setName("nuevo_nombre").setDescription("Nuevo nombre del ítem.").setRequired(false))
				.addStringOption((option) => option.setName("icono").setDescription("Nuevo icono del ítem.").setRequired(false))
				.addIntegerOption((option) =>
					option.setName("precio").setDescription("Nuevo precio del ítem.").setRequired(false).setMinValue(0)
				)
				.addStringOption((option) => option.setName("descripcion").setDescription("Nueva descripción del ítem.").setRequired(false))
				.addBooleanOption((option) => option.setName("almacenable").setDescription("¿Es almacenable?").setRequired(false))
				.addStringOption((option) => option.setName("mensaje").setDescription("Nuevo mensaje al usar el ítem.").setRequired(false))
				.addRoleOption((option) => option.setName("rol").setDescription("Nuevo rol a dar al usar el ítem.").setRequired(false))
				.addStringOption((option) => option.setName("grupo").setDescription("Nuevo grupo del ítem.").setRequired(false))
				.addStringOption((option) => option.setName("timeout").setDescription("Nueva duración del rol.").setRequired(false))
				.addStringOption((option) =>
					option.setName("background").setDescription("Nuevo fondo (nombre de imagen con extensión).").setRequired(false)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("eliminar")
				.setDescription("Elimina un ítem de la tienda.")
				.addStringOption((option) => option.setName("id").setDescription("Id del ítem a eliminar.").setRequired(true))
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const subcommand = interaction.options.getSubcommand();

			switch (subcommand) {
				case "visualizar":
					return await visualizarItems(interaction);
				case "añadir":
					return await añadirItem(interaction);
				case "editar":
					return await editarItem(interaction);
				case "eliminar":
					return await eliminarItem(interaction);
				default:
					return await replyError(interaction, "Comando no reconocido.");
			}
		},
		[logMessages]
	),
} as Command;

async function visualizarItems(interaction: IPrefixChatInputCommand) {
	const items = await Shop.find().lean();

	if (items.length === 0) {
		await interaction.reply({
			embeds: [new EmbedBuilder().setDescription("No hay ítems actualmente.").setColor(COLORS.errRed)],
		});
		return;
	}

	let page = 0;
	const itemsPerPage = 10;
	const totalPages = Math.ceil(items.length / itemsPerPage);

	const getPageContent = (page: number) => {
		const start = page * itemsPerPage;
		const end = start + itemsPerPage;
		const pageItems = items.slice(start, end).sort((a, b) => a.itemId.localeCompare(b.itemId));

		const embed = new EmbedBuilder()
			.setTitle("Lista de Ítems 🛒 (ID - Nombre)")
			.setDescription(pageItems.map((item, index) => `**${item.itemId}** - \`${item.name}\``).join("\n"))
			.setFooter({ text: `Página ${page + 1} de ${totalPages}` });

		const components = [
			new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId("prev")
					.setLabel("«")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === 0),
				new ButtonBuilder()
					.setCustomId("next")
					.setLabel("»")
					.setStyle(ButtonStyle.Primary)
					.setDisabled(page === totalPages - 1)
			),
			new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId("select_item")
					.setPlaceholder("Selecciona un ítem para ver detalles.")
					.addOptions(
						pageItems.map((item) => ({
							label: item.name,
							value: item._id.toString(),
						}))
					)
			),
		];

		return { embeds: [embed], components };
	};
	let pageContent = getPageContent(page);
	await replyOk(interaction, pageContent.embeds, undefined, pageContent.components);

	const message = await interaction.fetchReply();

	const collector = message?.createMessageComponentCollector<ComponentType.Button>({
		componentType: ComponentType.Button,
		time: 60000,
	});

	collector?.on("collect", async (i) => {
		if (i.user.id !== interaction.user.id) return await replyError(i, "No puedes interactuar con este menú.");

		if (i.customId === "prev" && page > 0) {
			page--;
		} else if (i.customId === "next" && page < totalPages - 1) {
			page++;
		}

		await i.update(getPageContent(page));
	});

	const selectCollector = message?.createMessageComponentCollector<ComponentType.StringSelect>({
		componentType: ComponentType.StringSelect,
		time: 60000,
	});

	selectCollector?.on("collect", async (i) => {
		if (i.user.id !== interaction.user.id) return await replyError(interaction, "No puedes interactuar con este menú.");

		const itemId = i.values[0];
		const item = items.find((item) => item._id.toString() === itemId);

		if (!item) return await replyError(interaction, "Ítem no encontrado.");

		const embed = new EmbedBuilder()
			.setTitle(`${item.name}`)
			.setDescription(`${item.description}`)
			.addFields(
				{ name: "Mensaje", value: item.message || "No tiene.", inline: false },
				{ name: "Icono", value: item.icon || "No tiene.", inline: true },
				{ name: "Precio", value: `${item.price}`, inline: true },
				{ name: "Almacenable", value: item.storable ? "Sí" : "No", inline: true },
				{ name: "Rol a dar", value: item.role || "Ninguno", inline: true },
				{ name: "Grupo", value: item.group || "Ninguno", inline: true },
				{ name: "Fondo", value: item.background ?? "No tiene.", inline: true },
				{
					name: "Timeout",
					value: item.timeout ? ms(item.timeout, { long: true }) : "No tiene.",
					inline: true,
				}
			);

		await i.reply({ embeds: [embed], ephemeral: true });
	});

	collector?.on("end", async () => {
		// Mapea cada fila de componentes para deshabilitarlos
		const disabledComponents = getPageContent(page).components.map((row) =>
			new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
				row.components.map((component) => {
					if (component instanceof ButtonBuilder) return ButtonBuilder.from(component).setDisabled(true);
					else if (component instanceof StringSelectMenuBuilder) return StringSelectMenuBuilder.from(component).setDisabled(true);
					return component;
				})
			)
		);

		// Actualiza el mensaje con los componentes deshabilitados
		await interaction.editReply({ components: disabledComponents });
	});
}

async function añadirItem(interaction: IPrefixChatInputCommand) {
	const name = interaction.options.getString("nombre", true);
	const icon = interaction.options.getString("icono", false);
	const price = interaction.options.getInteger("precio", true);
	const description = interaction.options.getString("descripcion", true);
	const storable = interaction.options.getBoolean("almacenable", true);
	const messageContent = interaction.options.getString("mensaje", false);
	const role = await interaction.options.getRole("rol", false);
	const group = interaction.options.getString("grupo", false);
	const timeoutStr = interaction.options.getString("timeout", false);
	const background = interaction.options.getString("background", false);

	let timeout = 0;
	if (timeoutStr) {
		try {
			timeout = ms(timeoutStr.toLowerCase());
		} catch (error) {
			return await replyError(interaction, "El formato del tiempo es inválido. Ejemplo: 1h, 30m");
		}
	}

	try {
		const existingItems = await Shop.find();
		const itemId = getId(existingItems);

		const newItem = new Shop({
			itemId: itemId.toString(),
			name,
			icon,
			price,
			description,
			storable,
			message: messageContent,
			role: role ? role.id : undefined,
			group,
			timeout,
			background,
		});

		await newItem.save();

		const embed = new EmbedBuilder()
			.setTitle("Ítem creado")
			.setDescription(`Se ha creado un ítem llamado \`${name}\``)
			.addFields(
				{ name: "Descripción", value: description, inline: false },
				{ name: "Mensaje", value: messageContent ?? "No tiene.", inline: false },
				{ name: "Icono", value: icon ?? "No tiene.", inline: true },
				{ name: "Precio", value: price.toString(), inline: true },
				{ name: "Almacenable", value: storable ? "Sí" : "No", inline: true },
				{ name: "Rol a dar", value: role ? role.name : "Ninguno", inline: true },
				{ name: "Grupo", value: group ?? "Ninguno", inline: true },
				{ name: "Fondo", value: background ?? "No tiene.", inline: true },
				{ name: "Timeout", value: timeoutStr ?? "No tiene.", inline: true }
			)
			.setColor(COLORS.okGreen);

		await replyOk(interaction, [embed]);

		// Registrar en el canal de logs
		return {
			logMessages: [
				{
					channel: getChannelFromEnv("logs"),
					user: interaction.user,
					description: `**${interaction.user.tag}** ha creado un ítem llamado \`${name}\`.`,
					fields: [
						{ name: "Nombre", value: name, inline: true },
						{ name: "Precio", value: price.toString(), inline: true },
						{ name: "Almacenable", value: storable ? "Sí" : "No", inline: true },
						{ name: "Rol a dar", value: role ? role.name : "Ninguno", inline: true },
						{ name: "Grupo", value: group ?? "Ninguno", inline: true },
						{ name: "Timeout", value: timeoutStr ?? "No tiene.", inline: true },
					],
				},
			],
		};
	} catch (error) {
		console.error("Error al crear ítem:", error);
		return await replyError(interaction, "Ocurrió un error al crear el ítem.");
	}
}

async function getUpdatedFields(interaction: IPrefixChatInputCommand, item: IShop) {
	let modified = false;
	const nuevoNombre = interaction.options.getString("nuevo_nombre", false);
	if (nuevoNombre) {
		item.name = nuevoNombre;
		modified = true;
	}

	const icon = interaction.options.getString("icono", false);
	if (icon !== null) {
		item.icon = icon;
		modified = true;
	}

	const description = interaction.options.getString("descripcion", false);
	if (description !== null) {
		item.description = description;
		modified = true;
	}

	const message = interaction.options.getString("mensaje", false);
	if (message !== null) {
		item.message = message;
		modified = true;
	}

	const group = interaction.options.getString("grupo", false);
	if (group !== null) {
		item.group = group;
		modified = true;
	}

	const price = interaction.options.getInteger("precio", false);
	if (price !== null) {
		item.price = price;
		modified = true;
	}

	const storable = interaction.options.getBoolean("almacenable", false);
	if (storable !== null) {
		item.storable = storable;
		modified = true;
	}

	const role = await interaction.options.getRole("rol", false);
	if (role !== null) {
		item.role = role.id;
		modified = true;
	}

	const timeoutStr = interaction.options.getString("timeout", false);
	if (timeoutStr !== null) {
		const timeout = ms(timeoutStr.toLowerCase());
		item.timeout = timeout;
		modified = true;
	}

	const background = interaction.options.getString("background", false);
	if (background !== null) {
		item.background = background;
		modified = true;
	}

	return modified;
}

async function editarItem(interaction: IPrefixChatInputCommand) {
	const id = interaction.options.getString("id", true);

	let item = await Shop.findOne<IShopDocument>({ itemId: id });
	if (!item) {
		return await replyError(interaction, `No se encontró ningún ítem con el id \`${id}\`.`);
	}
	let modified = false;
	try {
		modified = await getUpdatedFields(interaction, item);
	} catch (error) {
		return await replyError(interaction, "El formato del tiempo es inválido. Ejemplo: 1h, 30m");
	}

	try {
		if (!modified) {
			return await replyError(interaction, `No se modificaron ningun dato del ítem \`${item.name}\`.`);
		}
		const updatedItem = await item.save();

		let fields = [
			{ name: "Nombre", value: item.name, inline: true },
			{ name: "Descripción", value: updatedItem.description, inline: false },
			{ name: "Icono", value: updatedItem.icon || "No tiene.", inline: true },
			{ name: "Precio", value: Number(updatedItem.price).toString(), inline: true },
			{ name: "Almacenable", value: updatedItem.storable ? "Sí" : "No", inline: true },
			{ name: "Rol a dar", value: updatedItem.role || "Ninguno", inline: true },
			{ name: "Grupo", value: updatedItem.group || "Ninguno", inline: true },
			{
				name: "Timeout",
				value: updatedItem.timeout ? ms(updatedItem.timeout, { long: true }) : "No tiene.",
				inline: true,
			},
		];
		const embed = new EmbedBuilder()
			.setTitle("Ítem editado")
			.setDescription(`Se ha editado el ítem \`${item.name}\`.`)
			.addFields(fields)
			.setColor(COLORS.okGreen);

		await replyOk(interaction, [embed]);

		// Registrar en el canal de logs
		return {
			logMessages: [
				{
					channel: getChannelFromEnv("logs"),
					user: interaction.user,
					description: `**${interaction.user.tag}** ha editado el ítem \`${item.name}\`.`,
					fields: fields,
				},
			],
		};
	} catch (error) {
		console.error("Error al editar ítem:", error);
		return await replyError(interaction, "Ocurrió un error al editar el ítem.");
	}
}

async function eliminarItem(interaction: IPrefixChatInputCommand) {
	const id = interaction.options.getString("id", true);

	const item = await Shop.findOne({ itemId: id });
	if (!item) {
		return await replyError(interaction, `No se encontró ningún ítem con el id \`${id}\`.`);
	}

	try {
		await item.deleteOne();

		await replyOk(interaction, [
			new EmbedBuilder().setDescription(`Se ha eliminado el ítem llamado \`${item.name}\`.`).setColor(COLORS.okGreen),
		]);

		// Registrar en el canal de logs
		return {
			logMessages: [
				{
					channel: getChannelFromEnv("logs"),
					user: interaction.user,
					description: `**${interaction.user.tag}** ha eliminado el ítem \`${id}\`.`,
					fields: [{ name: "Nombre", value: item.name, inline: true }],
				},
			],
		};
	} catch (error) {
		console.error("Error al eliminar ítem:", error);
		return await replyError(interaction, "Ocurrió un error al eliminar el ítem.");
	}
}
