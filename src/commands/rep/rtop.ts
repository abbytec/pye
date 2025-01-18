import { SlashCommandBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { HelperPoint } from "../../Models/HelperPoint.js";
import client from "../../redis.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";

export default {
	group: "🥳 - Puntos de reputación",
	data: new SlashCommandBuilder()
		.setName("rtop")
		.setDescription("Muestra el top de usuarios con más puntos de reputación")
		.addStringOption((option) =>
			option
				.setName("scope")
				.setDescription("Elige el alcance del ranking")
				.addChoices({ name: "Global", value: "global" }, { name: "Mensual", value: "monthly" })
				.setRequired(false)
		),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand) => {
			// Obtener el valor del argumento 'scope'
			const scope = interaction.options.getString("scope") ?? "global";

			// Definir el tamaño de la página
			const pageSize = 10;
			let page = 0;

			// Definir el total de páginas según el scope
			let totalPages = 0;

			// Función para obtener los datos según el scope
			const getTopData = async () => {
				if (scope === "global") {
					// Top global desde MongoDB
					const totalUsers = await HelperPoint.countDocuments();
					totalPages = Math.ceil(totalUsers / pageSize) || 1;

					// Asegurarse de que la página solicitada está dentro de los límites
					if (page < 0) page = 0;
					if (page >= totalPages) page = totalPages - 1;

					const users = await HelperPoint.find()
						.sort({ points: -1 })
						.skip(page * pageSize)
						.limit(pageSize)
						.lean();

					return users;
				} else {
					// Top mensual desde Redis
					const totalUsers = await client.zCard("top:rep");
					totalPages = Math.ceil(totalUsers / pageSize) || 1;

					// Asegurarse de que la página solicitada está dentro de los límites
					if (page < 0) page = 0;
					if (page >= totalPages) page = totalPages - 1;

					const rawData = await client.sendCommand<string[]>([
						"ZREVRANGE",
						"top:rep",
						(page * pageSize).toString(),
						((page + 1) * pageSize - 1).toString(),
						"WITHSCORES",
					]);

					// Luego parseas el resultado:
					const usersWithScores: Array<{ value: string; score: number }> = [];
					for (let i = 0; i < rawData.length; i += 2) {
						usersWithScores.push({
							value: rawData[i],
							score: Number(rawData[i + 1]),
						});
					}

					// Formatear los datos para consistencia
					const users = await Promise.all(
						usersWithScores.map(async (u) => {
							try {
								const member = await interaction.guild?.members.fetch(u.value).catch(() => null);
								return {
									_id: u.value,
									points: u.score,
									username: member?.user.username ?? "Usuario Desconocido",
								};
							} catch {
								return {
									_id: u.value,
									points: u.score,
									username: "Usuario Desconocido",
								};
							}
						})
					);

					return users;
				}
			};

			// Función para obtener la posición del usuario
			const getUserPosition = async () => {
				if (scope === "global") {
					const allDocs = await HelperPoint.find().sort({ points: -1 }).lean();
					const position = allDocs.findIndex((u) => u._id === interaction.user.id);
					return position !== -1 ? `#${position + 1}` : "No te encontré en el top.";
				} else {
					const rank = await client.zRevRank("top:rep", interaction.user.id);
					return rank !== null ? `#${rank + 1}` : "No te encontré en el top.";
				}
			};

			// Función para generar el contenido del embed y botones
			const generateContent = async (disableButtons = false) => {
				const users = await getTopData();
				const userPosition = await getUserPosition();

				// Construir los campos del embed
				const fields = [
					{
						name: scope === "global" ? "Top Global de Puntos de Reputación." : "Top Mensual de Puntos de Reputación.",
						value:
							users.length > 0
								? await Promise.all(
										users.map(async (u, i) => {
											try {
												const member = await interaction.guild?.members
													.fetch(u._id)
													.catch(() => ({ user: { username: u._id } }));
												return `**${page * pageSize + i + 1}.** [${member?.user.username}](https://discord.com/users/${
													u._id
												}) • ${u.points.toLocaleString()} puntos.`;
											} catch {
												return `**${
													page * pageSize + i + 1
												}.** Usuario Desconocido • ${u.points.toLocaleString()} puntos.`;
											}
										})
								  ).then((res) => res.join("\n"))
								: "No hay usuarios en el top.",
					},
					{
						name: "Tu posición",
						value: userPosition,
					},
				];

				// Crear el embed
				const embed = new EmbedBuilder()
					.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
					.setThumbnail("https://cdn.discordapp.com/attachments/916353103534632960/1035714342722752603/unknown.png")
					.addFields(fields)
					.setFooter({ text: `Página ${page + 1}/${totalPages}` })
					.setTimestamp();

				// Crear los botones
				const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents([
					new ButtonBuilder()
						.setStyle(ButtonStyle.Primary)
						.setLabel("«")
						.setCustomId("hp-topBack")
						.setDisabled(page <= 0 || disableButtons),
					new ButtonBuilder()
						.setStyle(ButtonStyle.Primary)
						.setLabel("»")
						.setCustomId("hp-topNext")
						.setDisabled(page + 1 >= totalPages || disableButtons),
				]);

				return { embeds: [embed], components: [buttons] };
			};

			// Enviar el mensaje inicial
			const initialContent = await generateContent();
			await replyInfo(interaction, initialContent.embeds, undefined, initialContent.components).catch((e) => console.error(e));

			// Obtener el mensaje enviado
			const sentMessage = await interaction.fetchReply();

			// Crear el collector para los botones
			const collector = sentMessage?.createMessageComponentCollector({
				filter: (i) => i.user.id === interaction.user.id && ["hp-topBack", "hp-topNext"].includes(i.customId),
				time: 60 * 1000, // 60 segundos
			});

			collector?.on("collect", async (i) => {
				if (i.customId === "hp-topBack" && page > 0) {
					page--;
				} else if (i.customId === "hp-topNext" && page + 1 < totalPages) {
					page++;
				} else {
					await i.deferUpdate();
					return;
				}

				const newContent = await generateContent();
				await i.update(newContent).catch((e) => console.error(e));
			});

			collector?.on("end", async () => {
				const disabledContent = await generateContent(true);
				await sentMessage?.edit(disabledContent).catch((e) => console.error(e));
			});
		},
		[]
	),
};
