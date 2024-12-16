import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	StringSelectMenuBuilder,
	Interaction,
	CacheType,
	User,
	GuildMember,
	EmbedField,
} from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { IModLogsDocument, ModLogs } from "../../Models/ModLogs.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { COLORS, getRoleFromEnv } from "../../utils/constants.js";
import { ObjectId } from "mongoose";
import { replyError } from "../../utils/messages/replyError.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

// Función para generar las Action Rows
const generateActionRows = (page: number, data: IModLogsDocument[], itemsPerPage: number, totalPages: number) => {
	const rows = [
		new ActionRowBuilder<ButtonBuilder | StringSelectMenuBuilder>().addComponents(
			new ButtonBuilder()
				.setCustomId("back")
				.setLabel("«")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(page === 0),
			new ButtonBuilder()
				.setCustomId("next")
				.setLabel("»")
				.setStyle(ButtonStyle.Primary)
				.setDisabled(page === totalPages - 1)
		),
	];

	const start = page * itemsPerPage;
	const end = start + itemsPerPage;
	const items = data.slice(start, end);

	if (items.length > 0) {
		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId("select_case")
			.setPlaceholder("Selecciona un caso para ver detalles")
			.addOptions(
				items.map((caso, index) => ({
					label: `#${start + index + 1} ${caso.type} ${caso.hiddenCase ? "removido " : ""}`,
					value: `${(caso._id as ObjectId).toString()}`,
					emoji: caso.hiddenCase ? "🙈" : "📝",
				}))
			);

		// Verificación opcional para asegurar que no se excedan las opciones
		if (selectMenu.data.options && selectMenu.data.options.length > 25) {
			throw new Error("El número de opciones del Select Menu excede el límite de 25.");
		}

		const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
		rows.push(selectRow);
	}

	return rows;
};

// Función para generar el embed de la página actual
const generateEmbed = (
	page: number,
	data: IModLogsDocument[],
	itemsPerPage: number,
	totalPages: number,
	user: User,
	interaction: IPrefixChatInputCommand,
	member?: GuildMember | null
) => {
	const start = page * itemsPerPage;
	const end = start + itemsPerPage;
	const items = data.slice(start, end);

	const embed = new EmbedBuilder()
		.setAuthor({
			name: user.tag,
			iconURL: user.displayAvatarURL(),
		})
		.setTitle(`📝 Casos de ${user.tag} ${member ? "" : "(Usuario baneado)"}`)
		.addFields([
			{
				name: "Casos Registrados",
				value: items.length
					? items
							.map(
								(c, index) =>
									`**#${start + index + 1}** | Moderador: \`${c.moderator}\` | ${
										c.hiddenCase ? "Sancion removida" : `Razón: ${c.reason}`
									}`
							)
							.join("\n")
					: "❌ No hay casos registrados.",
			},
		])
		.setFooter({ text: `Página ${page + 1} de ${totalPages}` })
		.setColor(COLORS.pyeLightBlue)
		.setTimestamp()
		.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null);

	return embed;
};

export default {
	group: "⚙️ - Administración y Moderación",
	data: new SlashCommandBuilder()
		.setName("cases")
		.setDescription("Muestra los casos de un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true).catch(() => null);
			if (!user) return;
			const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
			const viewer = await interaction.guild?.members.fetch(interaction.user.id);

			const data = await ModLogs.find({
				id: user.id,
				...(viewer?.roles.cache.has(getRoleFromEnv("staff")) ?? viewer?.roles.cache.has(getRoleFromEnv("staff"))
					? {}
					: { hiddenCase: { $ne: true } }),
			});

			if (!data.length) return await replyOk(interaction, "Este usuario no tiene casos registrados.");

			const itemsPerPage = 10;
			const totalPages = Math.ceil(data.length / itemsPerPage);
			let currentPage = 0;

			// Enviar el embed inicial
			const message = await interaction.editReply({
				embeds: [generateEmbed(currentPage, data, itemsPerPage, totalPages, user, interaction, member)],
				components: generateActionRows(currentPage, data, itemsPerPage, totalPages),
			});

			const collector = message.createMessageComponentCollector({
				time: 5 * 60 * 1000, // 5 minutos
			});

			collector.on("collect", async (i: Interaction<CacheType>) => {
				if (!i.isButton() && !i.isStringSelectMenu()) return;

				if (i.user.id !== interaction.user.id) return replyError(i, "No puedes interactuar con estos controles.");

				if (i.isButton()) {
					if (i.customId === "back") {
						if (currentPage > 0) currentPage--;
					} else if (i.customId === "next") {
						if (currentPage < totalPages - 1) currentPage++;
					}

					await i.update({
						embeds: [generateEmbed(currentPage, data, itemsPerPage, totalPages, user, interaction, member)],
						components: generateActionRows(currentPage, data, itemsPerPage, totalPages),
					});
				} else if (i.isStringSelectMenu()) {
					const caseId = i.values[0];
					const selectedCase = data.find((c) => (c._id as ObjectId).toString() === caseId);

					if (selectedCase) {
						const fields: EmbedField[] = [
							{ name: "Moderador", value: selectedCase.moderator, inline: true },
							{
								name: "Fecha",
								value: `<t:${Math.floor(selectedCase.date.getTime() / 1000)}:f>`,
								inline: true,
							},
							{
								name: `Sanción ${selectedCase.hiddenCase ? "removida" : "aplicada"}`,
								value: selectedCase.type || "Timeout",
								inline: true,
							},
							{
								name: `Razón ${selectedCase.hiddenCase ? "anterior" : ""}`,
								value: selectedCase.reason || "No especificada.",
								inline: false,
							},
						];
						if (selectedCase.hiddenCase) {
							fields.push({ name: "Motivo actual", value: selectedCase.reasonUnpenalized ?? "Razon desconocida", inline: false });
						}

						const caseEmbed = new EmbedBuilder()
							.setAuthor({
								name: user.tag,
								iconURL: user.displayAvatarURL(),
							})
							.setTitle(`📝 Caso #${data.findIndex((c) => (c._id as ObjectId).toString() === caseId) + 1}`)
							.addFields(fields)
							.setColor(COLORS.warnOrange)
							.setTimestamp()
							.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null);

						await i.reply({
							embeds: [caseEmbed],
							ephemeral: true,
						});
					} else await replyError(i, "No se encontró el caso seleccionado.");
				}
			});

			collector.on("end", async () => {
				await interaction
					.editReply({
						components: [],
					})
					.catch((e) => console.error(e));
			});
		}
	),
} as Command;
