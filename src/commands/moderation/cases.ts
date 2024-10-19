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
} from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ModLogs } from "../../Models/ModLogs.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { getRoleFromEnv } from "../../utils/constants.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("cases")
		.setDescription("Muestra los casos de un usuario.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction],
		async (interaction: ChatInputCommandInteraction) => {
			const user = interaction.options.getUser("usuario", true);
			const member = await interaction.guild?.members.fetch(user.id);
			const viewer = await interaction.guild?.members.fetch(interaction.user.id);

			if (!member) return replyError(interaction, "No se pudo encontrar al usuario en el servidor.");

			const data = await ModLogs.find({
				id: user.id,
				...(viewer?.roles.cache.has(getRoleFromEnv("staff")) || member.roles.cache.has(getRoleFromEnv("perms"))
					? {}
					: { hiddenCase: { $ne: true } }),
			}).exec();

			if (!data.length) return replyOk(interaction, "Este usuario no tiene casos registrados.");

			const itemsPerPage = 10;
			const totalPages = Math.ceil(data.length / itemsPerPage);
			let currentPage = 0;

			// Función para generar el embed de la página actual
			const generateEmbed = (page: number) => {
				const start = page * itemsPerPage;
				const end = start + itemsPerPage;
				const items = data.slice(start, end);

				const embed = new EmbedBuilder()
					.setAuthor({
						name: user.tag,
						iconURL: user.displayAvatarURL(),
					})
					.setTitle(`📝 Casos de ${user.tag}`)
					.addFields([
						{
							name: "Casos Registrados",
							value: items.length
								? items
										.map(
											(c, index) =>
												`**#${start + index + 1}** | Moderador: \`${c.moderator}\` | ${
													c.hiddenCase ? "sancion removida" : `Razón: ${c.reason}`
												}`
										)
										.join("\n")
								: "❌ No hay casos registrados.",
						},
					])
					.setFooter({ text: `Página ${page + 1} de ${totalPages}` })
					.setTimestamp()
					.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null);

				return embed;
			};

			// Función para generar las Action Rows
			const generateActionRows = (page: number) => {
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
								label: `Caso ${caso.hiddenCase ? "removido " : ""}${start + index + 1}`,
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

			// Enviar el embed inicial
			const message = await interaction.editReply({
				embeds: [generateEmbed(currentPage)],
				components: generateActionRows(currentPage),
			});

			const collector = message.createMessageComponentCollector({
				time: 5 * 60 * 1000, // 5 minutos
			});

			collector.on("collect", async (i: Interaction<CacheType>) => {
				if (!i.isButton() && !i.isStringSelectMenu()) return;

				if (i.user.id !== interaction.user.id)
					return i.reply({
						content: "❌ No puedes interactuar con estos controles.",
						ephemeral: true,
					});

				if (i.isButton()) {
					if (i.customId === "back") {
						if (currentPage > 0) currentPage--;
					} else if (i.customId === "next") {
						if (currentPage < totalPages - 1) currentPage++;
					}

					await i.update({
						embeds: [generateEmbed(currentPage)],
						components: generateActionRows(currentPage),
					});
				} else if (i.isStringSelectMenu()) {
					if (i.customId === "select_case") {
						const caseId = i.values[0];
						const selectedCase = data.find((c) => c._id.toString() === caseId);

						if (selectedCase) {
							const caseEmbed = new EmbedBuilder()
								.setAuthor({
									name: user.tag,
									iconURL: user.displayAvatarURL(),
								})
								.setTitle(`📝 Caso #${data.findIndex((c) => c._id.toString() === caseId) + 1}`)
								.addFields([
									{ name: "Razón", value: selectedCase.reason || "No especificada.", inline: true },
									{ name: "Moderador", value: selectedCase.moderator, inline: true },
									{
										name: "Fecha",
										value: `${new Date(selectedCase.date).toLocaleString("es-ES", {
											hour12: true,
											timeZone: "America/Argentina/Buenos_Aires",
										})}`,
										inline: true,
									},
									{
										name: `Sanción ${selectedCase.hiddenCase ? "removida" : "aplicada"}`,
										value: selectedCase.type || "Timeout",
										inline: true,
									},
								])
								.setTimestamp()
								.setThumbnail(interaction.guild?.iconURL({ extension: "gif" }) ?? null);

							await i.reply({
								embeds: [caseEmbed],
								ephemeral: true,
							});
						} else {
							await i.reply({
								content: "❌ No se encontró el caso seleccionado.",
								ephemeral: true,
							});
						}
					}
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
};
