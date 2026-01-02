import {
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
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { ModLogsDocument, ModLogs } from "../../Models/ModLogs.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { COLORS, getRoleFromEnv } from "../../utils/constants.js";
import { ObjectId } from "mongoose";
import { replyError } from "../../utils/messages/replyError.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

// Función para generar las Action Rows
const generateActionRows = (page: number, data: ModLogsDocument[], itemsPerPage: number, totalPages: number) => {
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
					value: `${caso._id.toString()}`,
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

const calculateItemsPerPage = (data: ModLogsDocument[]): number => {
	const avgCaseLength = 50;
	const maxFieldLength = 1024;
	const maxCasesPerField = Math.floor(maxFieldLength / avgCaseLength);

	let largestFieldValueLength = 0;
	for (const caseData of data) {
		const caseValueLength = caseData.reason?.length ?? 0;
		if (caseValueLength > largestFieldValueLength) {
			largestFieldValueLength = caseValueLength;
		}
	}
	const adjustedItemsPerPage = Math.min(maxCasesPerField, Math.max(1, Math.floor(maxFieldLength / (largestFieldValueLength || 50)))); // Evitar division por 0 y asegurar minimo 1
	return Math.max(adjustedItemsPerPage, 1);
};

const generatePageEmbed = (
	data: ModLogsDocument[],
	currentPage: number,
	itemsPerPage: number,
	user: User,
	interaction: IPrefixChatInputCommand,
	member?: GuildMember | null
): EmbedBuilder => {
	const startIndex = currentPage * itemsPerPage;
	const endIndex = Math.min(startIndex + itemsPerPage, data.length);
	const pageData = data.slice(startIndex, endIndex);

	const embed = new EmbedBuilder()
		.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
		.setTitle(` Casos de ${user.tag} ${member ? "" : "(Usuario baneado)"}`)
		.setColor(COLORS.pyeLightBlue)
		.setTimestamp()
		.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null);

	if (pageData.length) {
		const casesValue = pageData
			.map(
				(c, index) =>
					`**#${startIndex + index + 1}** | Moderador: \`${c.moderator}\` | ${
						c.hiddenCase ? "Sancion removida" : `Razón: ${c.reason}`
					}`
			)
			.join("\n");
		embed.addFields([{ name: "Casos Registrados", value: casesValue }]);
	} else {
		embed.addFields([{ name: "Casos Registrados", value: "❌ No hay casos registrados." }]);
	}

	embed.setFooter({ text: `Página ${currentPage + 1} de ${Math.ceil(data.length / itemsPerPage)}` });
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
			const viewer = await interaction.guild?.members.fetch(interaction.user.id).catch(() => undefined);

			const data = await ModLogs.find({
				id: user.id,
				...(viewer?.roles.cache.has(getRoleFromEnv("staff")) ?? viewer?.roles.cache.has(getRoleFromEnv("staff"))
					? {}
					: { hiddenCase: { $ne: true } }),
			});

			if (!data.length) return await replyOk(interaction, `El usuario ${user.tag} no tiene casos registrados.`);

			const itemsPerPage = calculateItemsPerPage(data);
			const totalPages = Math.ceil(data.length / itemsPerPage);
			let currentPage = 0;

			// Enviar el embed inicial
			const message = await interaction.editReply({
				embeds: [generatePageEmbed(data, currentPage, itemsPerPage, user, interaction, member)],
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
						embeds: [generatePageEmbed(data, currentPage, itemsPerPage, user, interaction, member)],
						components: generateActionRows(currentPage, data, itemsPerPage, totalPages),
					});
				} else if (i.isStringSelectMenu()) {
					const caseId = i.values[0];
					const selectedCase = data.find((c) => c._id.toString() === caseId);

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
						if (selectedCase.duration)
							fields.push({ name: "Duración", value: `${selectedCase.duration / 60000} min`, inline: true });
						if (selectedCase.hiddenCase)
							fields.push({ name: "Motivo actual", value: selectedCase.reasonUnpenalized ?? "Razon desconocida", inline: false });

						const caseEmbed = new EmbedBuilder()
							.setAuthor({
								name: user.tag,
								iconURL: user.displayAvatarURL(),
							})
							.setTitle(`📝 Caso #${data.findIndex((c) => c._id.toString() === caseId) + 1}`)
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
