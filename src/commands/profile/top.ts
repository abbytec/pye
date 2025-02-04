// src/commands/Currency/top.ts
import {
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ButtonInteraction,
	Interaction,
	Message,
} from "discord.js";
import { Home, IHomeDocument } from "../../Models/Home.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import redis from "../../redis.js";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { Bumps } from "../../Models/Bump.js";
import { generateLeaderboard } from "../../utils/generic.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";

const key = {
	rob: {
		title: "Asaltantes",
		url: "https://cdn.discordapp.com/attachments/916353103534632960/1017170796331933828/Thief.png",
	},
	cash: {
		title: "Monedas",
		url: "https://cdn.discordapp.com/attachments/916353103534632960/1017132949688299660/unknown.png",
	},
	apuestas: {
		title: "Apostadores",
		url: "https://cdn.discordapp.com/attachments/916353103534632960/1019088066616512562/unknown.png",
	},
	caps: {
		title: "Policías",
		url: "https://cdn.discordapp.com/attachments/916353103534632960/1019797558870147082/unknown.png",
	},
	house: {
		title: "Casas",
		url: "https://cdn.discordapp.com/attachments/916353103534632960/1017138053283852338/money.png",
	},
	all: {
		title: "Dinero total",
		url: "https://cdn.discordapp.com/attachments/916353103534632960/1017138053283852338/money.png",
	},
	bumps: {
		title: "Bumps",
		url: "https://cdn.discordapp.com/attachments/916353103534632960/1017138053283852338/money.png",
	},
};

type LeaderboardType = keyof typeof key;

export default {
	group: "👤 - Perfiles (Casino)",
	data: new SlashCommandBuilder()
		.setName("top")
		.setDescription("Muestra el top de coins.")
		.addStringOption((option) =>
			option
				.setName("tipo")
				.setDescription("Tipo de top que deseas ver")
				.setRequired(true)
				.addChoices(
					{ name: "Cash", value: "cash" },
					{ name: "Robos", value: "rob" },
					{ name: "Apuestas", value: "apuestas" },
					{ name: "Caps", value: "caps" },
					{ name: "Casas", value: "house" },
					{ name: "Dinero Total", value: "all" },
					{ name: "Bumps", value: "bumps" }
				)
		)
		.addIntegerOption((option) => option.setName("pagina").setDescription("Número de página").setRequired(false)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			const type = (interaction.options.getString("tipo") ?? "cash") as LeaderboardType;
			let page = interaction.options.getInteger("pagina") ?? 1;
			page = Math.max(page, 1);

			if (!Object.keys(key).includes(type)) return await replyError(interaction, "El tipo de top seleccionado no es válido.");

			try {
				const content = await generateContent(type, page, user, interaction);
				await replyOk(interaction, content.embeds, undefined, content.components);

				const message = await interaction.fetchReply();

				if (!(message instanceof Message)) return console.error("El mensaje obtenido no es una instancia de Message.");

				const collector = message.createMessageComponentCollector({
					filter: (i: Interaction) => i.isButton() && i.user.id === user.id && ["topBack", "topNext"].includes(i.customId),
					time: 60000, // 60 segundos
				});

				collector.on("collect", async (i: ButtonInteraction) => {
					if (i.customId === "topBack" && page > 1) page--;
					else if (i.customId === "topNext") page++;
					else {
						await i.deferUpdate();
						return;
					}

					const newContent = await generateContent(type, page, user, interaction);
					await i.update(newContent);
				});

				collector.on("end", async () => {
					const disabledContent = await generateContent(type, page, user, interaction, true);
					await message.edit(disabledContent).catch(() => null);
				});
			} catch (error) {
				console.error("Error ejecutando el comando top:", error);
				await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"top",
			[
				{
					name: "tipo",
					required: true,
					options: ["cash", "rob", "apuestas", "caps", "house", "all", "bumps"],
				},
				{
					name: "pagina",
					required: false,
				},
			],
			["leaderboard"]
		),
} as Command;

async function generateContent(type: LeaderboardType, page: number, user: any, interaction: IPrefixChatInputCommand, disable: boolean = false) {
	let embed: EmbedBuilder;
	let actionRow: ActionRowBuilder<ButtonBuilder>;

	switch (type) {
		case "house":
			({ embed, actionRow } = await generateHouseLeaderboard(page, user, interaction, disable));
			break;
		case "bumps":
			({ embed, actionRow } = await generateBumpsLeaderboard(page, user, interaction, disable));
			break;
		case "cash":
		case "rob":
		case "apuestas":
		case "caps":
		case "all":
			({ embed, actionRow } = await generateRedisLeaderboard(type, page, user, interaction, disable));
			break;
		default:
			throw new Error("Tipo de leaderboard inválido.");
	}

	return {
		embeds: [embed],
		components: [actionRow],
	};
}

// Función para generar el leaderboard de bumps
async function generateBumpsLeaderboard(page: number, user: any, interaction: IPrefixChatInputCommand, disable: boolean) {
	return generateLeaderboard(page, user, disable, {
		title: `🎉 Bump Leaderboard`,
		dataFetch: async () => {
			return await Bumps.aggregate([
				{
					$group: {
						_id: "$user",
						count: { $sum: 1 },
					},
				},
			]);
		},
		sortFunction: (a, b) => b.count - a.count,
		positionFinder: (data, userId) => data.findIndex((u) => u._id === userId),
		descriptionBuilder: async (item, index, start) => {
			let member = await interaction.guild?.members.fetch(item._id).catch(() => undefined);
			return `**${start + index + 1}.** [${member?.user.username ?? "Usuario Desconocido"}](https://discord.com/users/${item._id}) • ${
				item.count
			} bumps`;
		},
	});
}

// Función para generar el leaderboard de casas
async function generateHouseLeaderboard(page: number, user: any, interaction: IPrefixChatInputCommand, disable: boolean) {
	return generateLeaderboard(page, user, disable, {
		title: "🏡 Top de casas.",
		dataFetch: async () => {
			return await Home.find();
		},
		sortFunction: (a: IHomeDocument, b: IHomeDocument) => b.house.level - a.house.level,
		positionFinder: (data: IHomeDocument[], userId) => data.findIndex((u) => u.id === userId),
		descriptionBuilder: async (item, index, start) => {
			let member = await interaction.guild?.members.fetch(item.id).catch(() => undefined);
			return `**${start + index + 1}.** [${member?.user.tag ?? "Usuario Desconocido"}](https://discord.com/users/${
				item.id
			}) • \`Nivel:\` **${item.house.level}**.\n\`Nombre:\` ${item.name ?? "🏠 Casa de " + (member?.user.tag ?? "Usuario Desconocido")}}`;
		},
	});
}

async function generateRedisLeaderboard(type: LeaderboardType, page: number, user: any, interaction: IPrefixChatInputCommand, disable: boolean) {
	const ITEMS_PER_PAGE = 10;
	const leaderboardKey = type === "all" ? "all" : type;
	let totalItems = await redis.zCount(`top:${leaderboardKey}`, "-inf", "+inf");
	const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
	page = Math.min(page, totalPages);

	const userPosition = await redis.zRevRank(`top:${leaderboardKey}`, user.id);
	const position = userPosition ?? -1;

	const start = (page - 1) * ITEMS_PER_PAGE;
	const end = start + ITEMS_PER_PAGE - 1;
	const topData: string[] = await redis.sendCommand(["ZREVRANGE", `top:${leaderboardKey}`, start.toString(), end.toString(), "WITHSCORES"]);

	const descriptions = await Promise.all(
		topData
			?.filter((_, i) => i % 2 === 0)
			.map(async (id, index) => {
				const score = Number(topData[index * 2 + 1]);
				let member = await interaction.guild?.members.fetch(id.toString()).catch(() => undefined);

				let rankIcon = `${start + index + 1}`;
				if (start + index + 1 === 1) {
					rankIcon = type === "caps" ? "<:policebadge:1313338489290489897>" : "<:server_owner:1313337498893815858>";
				}

				return `**${rankIcon}.** [${
					member?.user.tag ?? "Usuario Desconocido"
				}](https://discord.com/users/${id}) • ${pyecoin} ${score.toLocaleString()}`;
			})
	);

	const embedDescription = descriptions.join("\n") || "No hay usuarios en el top.";

	const embed = new EmbedBuilder()
		.setTitle(`Top ${key[type]?.title || "General"}`)
		.setThumbnail(key[type]?.url || "https://cdn.discordapp.com/attachments/916353103534632960/1017138053283852338/money.png")
		.setDescription(embedDescription)
		.addFields([
			{
				name: "Tu posición",
				value: position !== -1 ? `#${position + 1}` : "No te encontré en el top.",
			},
		])
		.setFooter({ text: `Página ${page}/${totalPages}` })
		.setColor(COLORS.pyeLightBlue)
		.setTimestamp();

	const backButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Primary)
		.setLabel("«")
		.setCustomId("topBack")
		.setDisabled(page <= 1 || disable);

	const nextButton = new ButtonBuilder()
		.setStyle(ButtonStyle.Primary)
		.setLabel("»")
		.setCustomId("topNext")
		.setDisabled(page >= totalPages || disable);

	const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(backButton, nextButton);

	return { embed, actionRow, position, totalPages };
}
