import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	Collection,
	EmbedBuilder,
	GuildMember,
	User,
	StringSelectMenuBuilder,
	ButtonStyle,
	ButtonBuilder,
	ActionRowBuilder,
	Interaction,
	CacheType,
	TextChannel,
	AnyComponentBuilder,
	ButtonInteraction,
	InteractionResponse,
	Message,
} from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { increaseHomeMonthlyIncome } from "../../Models/Home.js";
import { IUserModel, Users, getOrCreateUser } from "../../Models/User.js";
import { PostHandleable } from "../../types/middleware.js";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { calculateJobMultiplier, getRandomNumber } from "../../utils/generic.js";
import { replyError } from "../../utils/messages/replyError.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
const game = new Set();
const Aces = [
	"<:A_clubs:917537119772213289>",
	"<:A_diamonds:917537145315524658>",
	"<:A_hearts:917537176001052672>",
	"<:A_spades:917537196402176041>",
];
const buttonsDisabled = [
	new ActionRowBuilder<ButtonBuilder>().addComponents([
		new ButtonBuilder().setStyle(1).setCustomId("bj-hit").setLabel("Otra").setDisabled(true),
		new ButtonBuilder().setStyle(3).setCustomId("bj-stand").setLabel("Quedarse").setDisabled(true),
		new ButtonBuilder().setStyle(2).setCustomId("bj-ddown").setLabel("Doblar apuesta").setDisabled(true),
		new ButtonBuilder().setStyle(2).setCustomId("bj-split").setLabel("Dividir juego").setDisabled(true),
	]),
];

const usage = [
	"`Otra` - toma otra carta.",
	"`Quedarse` - termina el juego.",
	"`Doblar apuesta` - duplica tu apuesta, toma una carta y termina el juego.",
];

const buttons = [
	new ActionRowBuilder<ButtonBuilder>().addComponents([
		new ButtonBuilder().setStyle(1).setCustomId("bj-hit").setLabel("Otra"),
		new ButtonBuilder().setStyle(3).setCustomId("bj-stand").setLabel("Quedarse"),
		new ButtonBuilder().setStyle(2).setCustomId("bj-ddown").setLabel("Doblar apuesta"),
		new ButtonBuilder().setStyle(2).setCustomId("bj-split").setLabel("Dividir juego").setDisabled(true),
	]),
];

const STATIC_CARDS: Record<string, number | "relatable"> = {
	"<:clubs_2:1313496389254381589>": 2,
	"<:diamonds_2:1313494931733610646>": 2,
	"<:hearts_2:1313495120900919336>": 2,
	"<:spades_2:1313496103852834887>": 2,
	"<:clubs_3:1313496390789365902>": 3,
	"<:diamonds_3:1313501116285190156>": 3,
	"<:hearts_3:1313495122897272914>": 3,
	"<:spades_3:1313496105459253319>": 3,
	"<:clubs_4:1313494910326018139>": 4,
	"<:diamonds_4:1313494936091492424>": 4,
	"<:hearts_4:1313495302350700614>": 4,
	"<:spades_4:1313496107715657839>": 4,
	"<:clubs_5:1313494911923781634>": 5,
	"<:diamonds_5:1313494964990115931>": 5,
	"<:hearts_5:1313495303869173851>": 5,
	"<:spades_5:1313496109213290506>": 5,
	"<:hearts_6:1313495305462878260>": 6,
	"<:diamonds_6:1313494967754424340>": 6,
	"<:clubs_6:1313494913614217246>": 6,
	"<:spades_6:1313496110941343786>": 6,
	"<:clubs_7:1313494915237412884>": 7,
	"<:diamonds_7:1313494969431887893>": 7,
	"<:hearts_7:1313496023208820788>": 7,
	"<:spades_7:1313496112543436880>": 7,
	"<:clubs_8:1313494917237968896>": 8,
	"<:diamonds_8:1313494971147616366>": 8,
	"<:hearts_8:1313496025209765958>": 8,
	"<:spades_8:1313496114573479957>": 8,
	"<:diamonds_9:1313494973118943272>": 9,
	"<:hearts_9:1313496027235614783>": 9,
	"<:spades_9:1313496116716638260>": 9,
	"<:clubs_9:1313494919024738366>": 9,
	"<:clubs_10:1313494921231077446>": 10,
	"<:hearts_10:1313496029076656281>": 10,
	"<:spades_10:1313504994925744180>": 10,
	"<:diamonds_10:1313494975412965458>": 10,
	"<:clubs_J:1313494925685555240>": 10,
	"<:diamonds_J:1313495114475245648>": 10,
	"<:spades_J:1313496184635134042>": 10,
	"<:hearts_J:1313496097263452210>": 10,
	"<:clubs_Q:1313494929619812392>": 10,
	"<:diamonds_Q:1313495119101427792>": 10,
	"<:hearts_Q:1313496101927780392>": 10,
	"<:spades_Q:1313496187944566885>": 10,
	"<:diamonds_K:1313495116647895111>": 10,
	"<:hearts_K:1313496099717251092>": 10,
	"<:spades_K:1313496186245611550>": 10,
	"<:clubs_K:1313494927656620062>": 10,
	"<:clubs_A:1313494923487612978>": "relatable",
	"<:diamonds_A:1313494976914653258>": "relatable",
	"<:hearts_A:1313496031165681674>": "relatable",
	"<:spades_A:1313496182923989142>": "relatable",
};

export default {
	data: new SlashCommandBuilder()
		.setName("blackjack")
		.setDescription("Juega a las cartas con el bot, quien llegue a estar más cerca sin pasarse u obtenga 21, gana.")
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("la cantidad que quieres apostar (Máximo 1100)").setRequired(true)
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), verifyCooldown("blackjack", 3000)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const amount = interaction.options.getInteger("cantidad", true);
			let data = await getOrCreateUser(interaction.user.id);
			if (amount < 0) return replyError(interaction, "Debe ser mayor a 0 claro.");
			if (data.cash < amount) return replyError(interaction, "No tienes suficiente para apostar.");
			if (amount > 1100) return replyError(interaction, "No puedes apostar más de 1100 PyE Coins.");
			if (game.has(interaction.user.id)) return replyError(interaction, "Ya te encuentras jugando.");
			game.add(interaction.user.id);
			const cardsGame = new Collection<string, "relatable" | number>();
			const gameEmbed = new EmbedBuilder().setColor(0x3a9f4).setAuthor({
				name: interaction.user.tag,
				iconURL: interaction.user.displayAvatarURL({ extension: "png", size: 1024 }),
			});
			// <:A_diamonds:917537145315524658> y <:5_hearts:917517203698491412>, <:K_hearts:917518224625655828>, <:K_hearts:917518224625655828>, <:Q_clubs:917518386601295882>
			//const firstCards = ['<:Q_clubs:917518386601295882>', '<:K_hearts:917518224625655828>']
			const CARDS: Collection<string, number | "relatable"> = new Collection(Object.entries(STATIC_CARDS));
			const dealerCards = CARDS.randomKey(1);
			const firstCards = CARDS.randomKey(2);
			const dealerValue = dealerCards.reduce((a, b) => a + parseRelatable(a, CARDS.get(b) ?? 0), 0);
			const firstValue = firstCards.reduce((a, b) => a + parseRelatable(a, CARDS.get(b) ?? 0), 0);

			let res = await isBlackJack(firstValue, dealerValue, gameEmbed, data, game, amount, interaction, firstCards, dealerCards);
			if (res) return;

			let gameCards = [...firstCards];
			let gameDealerCards = [...dealerCards];
			let hands = [[gameCards[0]], [gameCards[1]]];
			changeCard(gameCards, gameDealerCards, cardsGame, CARDS);
			removeCards(gameCards, gameDealerCards, CARDS);
			const cardsValue = () => gameCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0);
			const dealerCardsValue = () => gameDealerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0);

			gameEmbed.setDescription(usage.join("\n")).addFields([
				{
					name: "**Tu mano**",
					value: `${gameCards.join(" ")}\n\n**Valor:** \`${cardsValue()}\``,
					inline: true,
				},
				{
					name: "**Mano del dealer**",
					value: `${gameDealerCards.join(" ")} <:back_card:917518009575276635>\n\n**Valor:** \`${dealerCardsValue()}\``,
					inline: true,
				},
				{
					name: "\u200b",
					value: "\u200b",
					inline: true,
				},
			]);

			const buttons = [
				new ActionRowBuilder<ButtonBuilder>().addComponents([
					new ButtonBuilder().setStyle(1).setCustomId("bj-hit").setLabel("Otra"),
					new ButtonBuilder().setStyle(3).setCustomId("bj-stand").setLabel("Quedarse"),
					new ButtonBuilder().setStyle(2).setCustomId("bj-ddown").setLabel("Doblar apuesta"),
					new ButtonBuilder()
						.setStyle(2)
						.setCustomId("bj-split")
						.setLabel("Dividir juego")
						.setDisabled(cardsGame.get(gameCards[0]) !== cardsGame.get(gameCards[1])),
				]),
			];

			const m = await interaction.reply({ embeds: [gameEmbed], components: [...buttons] });
			const check = await checkEmbed(amount, interaction.user.id, m, {
				cards: [gameCards, gameDealerCards],
				values: [cardsValue(), dealerCardsValue()],
			});

			if (!check) return startGame(m, gameCards, gameDealerCards, cardsGame, CARDS, amount, interaction.user.id, interaction, hands);
		}
	),
} as Command;

function cardsValue(cards: string[], cardsGame: Collection<string, number | "relatable">) {
	let newOrder: string[] = [];
	if (cards.some((card) => Aces.includes(card))) newOrder = orderGame(cards) ?? [];
	else newOrder = [...cards];
	return newOrder.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0);
}

function startGame(
	interactionResponse: InteractionResponse<true> | Message,
	gameCards: string[],
	gameDealerCards: string[],
	cardsGame: Collection<string, number | "relatable">,
	cards: Collection<string, number | "relatable">,
	amount: number,
	userId: string,
	interaction: IPrefixChatInputCommand,
	hands: string[][]
) {
	let newCard, res, otherGame, newCardsDealer, otherCard, games;

	interactionResponse
		.createMessageComponentCollector({
			filter: (interactionB) =>
				["bj-hit", "bj-stand", "bj-ddown", "bj-split", "bj-cancel"].includes(interactionB.customId) && interactionB.user.id === userId,
			time: 60e3,
		})
		.on("collect", async (i: ButtonInteraction) => {
			if (!i.deferred) await i.deferUpdate().catch(() => null);
			switch (i.customId) {
				case "bj-hit":
					newCard = cards.randomKey(1);
					gameCards.push(newCard[0]);
					changeCard(newCard, null, cardsGame, cards);
					removeCards(newCard, null, cards);
					res = await checkEmbed(amount, userId, interactionResponse, {
						cards: [gameCards, gameDealerCards],
						values: [cardsValue(gameCards, cardsGame), cardsValue(gameDealerCards, cardsGame)],
					});

					if (!res) {
						let gameEmbed = new EmbedBuilder()
							.setDescription(usage.join("\n"))
							.addFields([
								{
									name: "**Tu mano**",
									value: `${gameCards.join(" ")}\n\n**Valor:** \`${cardsValue(gameCards, cardsGame)}\``,
									inline: true,
								},
								{
									name: "**Mano del dealer**",
									value: `${gameDealerCards.join(" ")} <:back_card:917518009575276635>\n\n**Valor:** \`${cardsValue(
										gameDealerCards,
										cardsGame
									)}\``,
									inline: true,
								},
							])
							.setColor(0x3a9f4);
						return interactionResponse.edit({ embeds: [gameEmbed], components: [...buttons] }).catch(() => null);
					}

					break;
				case "bj-stand":
					newCardsDealer = cards.randomKey(getRandomNumber(2, 3));
					changeCard(null, newCardsDealer, cardsGame, cards);
					removeCards(null, newCardsDealer, cards);
					gameDealerCards = gameDealerCards.concat(newCardsDealer);
					await checkGame(
						amount,
						userId,
						{
							cards: [gameCards, gameDealerCards],
							values: [cardsValue(gameCards, cardsGame), cardsValue(gameDealerCards, cardsGame)],
						},

						interactionResponse,
						game
					);
					break;
				case "bj-ddown":
					amount = amount * 2;
					otherCard = cards.randomKey(1);
					gameCards.push(otherCard[0]);
					changeCard(otherCard, null, cardsGame, cards);
					removeCards(otherCard, null, cards);
					if (cardsValue(gameCards, cardsGame) < 21) {
						let extraCard = cards.randomKey(getRandomNumber(2, 3));
						changeCard(null, extraCard, cardsGame, cards);
						removeCards(null, extraCard, cards);
						gameDealerCards = gameDealerCards.concat(extraCard);
					}
					await checkGame(
						amount,
						userId,
						{
							cards: [gameCards, gameDealerCards],
							values: [cardsValue(gameCards, cardsGame), cardsValue(gameDealerCards, cardsGame)],
						},
						interactionResponse,
						game
					);
					break;
				case "bj-split":
					games = createGames(hands, cards, cardsGame);
					gameCards = games[0];
					otherGame = games[1];
					otherCard = cards.randomKey(1);
					changeCard(null, otherCard, cardsGame, cards);
					removeCards(null, otherCard, cards);
					await splitGame(
						interactionResponse,
						gameCards,
						gameDealerCards,
						cardsGame,
						cards,
						amount,
						interaction,
						hands,
						otherGame,
						otherCard
					);
					break;
			}
		})
		.on("end", () => game.delete(userId));
}

async function checkEmbed(amount: number, userId: string, msg: InteractionResponse | Message, cards: { cards: string[][]; values: number[] }) {
	const data = await getOrCreateUser(userId);
	let x = amount;
	const {
		cards: [playerCards, dealerCards],
		values: [playerValue, dealerValue],
	} = cards;
	const user = await msg.client.users.fetch(userId);
	const unEmbed = new EmbedBuilder().setAuthor({ name: user?.displayName ?? "Desconocido", iconURL: user?.displayAvatarURL() });
	if (playerValue >= 21 || dealerValue >= 21) {
		if (playerValue > 21 && dealerValue > 21) {
			unEmbed.setColor(0xff8d01).setDescription("Resultado: Empate. Devolviendo dinero.");
		} else if (playerValue > 21) {
			data.bet += amount;
			data.cash -= amount;
			await data.save();
			unEmbed.setColor(0xef5350).setDescription(`Resultado: Te excediste por lo que perdiste... ${pyecoin} **${amount}**.`);
		} else {
			amount = calculateJobMultiplier(data.profile?.job, amount, data.couples);
			increaseHomeMonthlyIncome(userId, amount);
			checkQuestLevel({ msg, money: amount, userId });
			data.bet += x;
			data.earnings += amount;
			data.cash += amount;
			await data.save();
			unEmbed.setColor(0x66bb6a).setDescription(`Resultado: ¡Ganaste! ${pyecoin} **${amount}**.`);
		}

		unEmbed.addFields([
			{
				name: "**Tu mano**",
				value: `${playerCards.join(" ")}\n\n**Valor:** \`${playerValue}\``,
				inline: true,
			},
			{
				name: "**Mano del dealer**",
				value: `${dealerCards.join(" ")} <:back_card:917518009575276635>\n\n**Valor:** \`${dealerValue}\``,
				inline: true,
			},
		]);
		game.delete(userId);
		return msg.edit({ embeds: [unEmbed], components: [...buttonsDisabled] }).catch(() => null);
	} else return null;
}

async function checkGame(
	amount: number,
	userId: string,
	cards: { cards: string[][]; values: number[] },
	msg: InteractionResponse | Message,
	game: Set<unknown>
) {
	game.delete(userId);
	const data = await getOrCreateUser(userId);
	const {
		cards: [playerCards, dealerCards],
		values: [playerValue, dealerValue],
	} = cards;
	const user = msg.client.users.resolve(userId);
	let x = amount;
	const endGame = new EmbedBuilder().setAuthor({ name: user?.displayName ?? "Desconocido", iconURL: user?.displayAvatarURL() });
	if (playerValue >= 21 || dealerValue >= 21) {
		if (playerValue > 21 && dealerValue > 21) {
			endGame.setColor(0xff8d01).setDescription("Resultado: Empate. Devolviendo dinero.");
		} else if (playerValue > 21) {
			data.bet += amount;
			data.cash -= amount;
			await data.save();
			endGame.setColor(0xef5350).setDescription(`Resultado: Te excediste por lo que perdiste... ${pyecoin} **${amount}**.`);
		} else if (dealerValue === 21) {
			data.bet += amount;
			data.cash -= amount;
			await data.save();
			endGame
				.setColor(0xef5350)

				.setDescription(`Resultado: Dealer se acerco más. ${pyecoin} **${amount}**.`);
		} else {
			amount = calculateJobMultiplier(data.profile?.job, amount, data.couples);
			increaseHomeMonthlyIncome(userId, amount);
			checkQuestLevel({ msg: msg, money: amount, userId } as IQuest);
			data.bet += x;
			data.earnings += amount;
			data.cash += amount;
			await data.save();
			endGame.setColor(0x66bb6a).setDescription(`Resultado: ¡Ganaste! ${pyecoin} **${amount}**.`);
		}

		endGame.addFields([
			{
				name: "**Tu mano**",
				value: `${playerCards.join(" ")}\n\n**Valor:** \`${playerValue}\``,
				inline: true,
			},
			{
				name: "**Mano del dealer**",
				value: `${dealerCards.join(" ")}\n\n**Valor:** \`${dealerValue}\``,
				inline: true,
			},
		]);
		return msg.edit({ embeds: [endGame], components: [...buttonsDisabled] }).catch(() => null);
	} else if (playerValue <= 21 || dealerValue <= 21) {
		if (playerValue == dealerValue) {
			endGame.setColor(0xff8d01).setDescription("Resultado: Empate. Devolviendo dinero.");
		} else if (dealerValue > playerValue) {
			data.bet += amount;
			data.cash -= amount;
			await data.save();
			endGame.setColor(0xef5350).setDescription(`Resultado: Dealer se acerco más. ${pyecoin} **${amount}**.`);
		} else {
			amount = calculateJobMultiplier(data.profile?.job, amount, data.couples);
			increaseHomeMonthlyIncome(userId, amount);
			checkQuestLevel({ msg: msg, money: amount, userId } as IQuest);
			data.bet += x;
			data.earnings += amount;
			data.cash += amount;
			await data.save();
			endGame.setColor(0x66bb6a).setDescription(`Resultado: ¡Ganaste!  ${pyecoin} **${amount}**.`);
		}

		endGame.addFields([
			{
				name: "**Tu mano**",
				value: `${playerCards.join(" ")}\n\n**Valor:** \`${playerValue}\``,
				inline: true,
			},
			{
				name: "**Mano del dealer**",
				value: `${dealerCards.join(" ")}\n\n**Valor:** \`${dealerValue}\``,
				inline: true,
			},
		]);
		return msg.edit({ embeds: [endGame], components: [...buttonsDisabled] }).catch(() => null);
	}
}

async function isBlackJack(
	firstValue: number,
	dealerValue: number,
	embed: EmbedBuilder,
	data: IUserModel,
	game: Set<unknown>,
	amount: number,
	interaction: IPrefixChatInputCommand,
	firstCards: any[],
	dealerCards: any[]
) {
	let x = amount;
	if (firstValue >= 21 || dealerValue >= 21) {
		if (firstValue === dealerValue) {
			embed.setColor(0xff8d01).setDescription("Resultado: Empate. Devolviendo dinero.");
		} else if (dealerValue == 21) {
			data.cash -= amount;
			await data.save();
			embed.setColor(0xef5350).setDescription(`Resultado: Perdiste... ${pyecoin} **${amount}**.`);
		} else if (firstValue == 21) {
			amount = calculateJobMultiplier(data.profile?.job, amount, data.couples);
			increaseHomeMonthlyIncome(interaction.user.id, amount);
			checkQuestLevel({ msg: interaction, money: amount, userId: interaction.user.id } as IQuest);
			data.bet += x;
			data.earnings += amount;
			data.cash += amount;
			await data.save();
			embed.setColor(0x66bb6a).setDescription(`Resultado: ¡Ganaste! ${pyecoin} **${amount}**.`);
		}
		game.delete(interaction.user.id);
		embed.addFields([
			{
				name: "**Tu mano**",
				value: `${firstCards.join(" ")}\n\n**Valor:** ${firstValue == 21 ? "`Blackjack`" : `\`${firstValue}\``}`,
				inline: true,
			},
			{
				name: "**Mano del dealer**",
				value: `${dealerCards.join(" ")} <:back_card:917518009575276635>\n\n**Valor:** ${
					dealerValue == 21 ? "`Blackjack`" : `\`${dealerValue}\``
				}`,
				inline: true,
			},
		]);

		return await interaction.reply({ embeds: [embed], components: [...buttonsDisabled] });
	} else return null;
}

async function splitGame(
	m: InteractionResponse | Message,
	gameCards: string[],
	gameDealerCards: string[],
	cardsGame: Collection<string, number | "relatable">,
	cards: Collection<string, number | "relatable">,
	amount: number,
	interaction: IPrefixChatInputCommand,
	hands: string[][],
	otherHand: string[],
	otherCard: string[]
) {
	await m
		.edit({
			embeds: [
				new EmbedBuilder()
					.setDescription(usage.join("\n"))
					.addFields([
						{
							name: "**Tu mano 1**",
							value: `${gameCards.join(" ")}\n\nValor: ${cardsValue(gameCards, cardsGame)}`,
							inline: true,
						},
						{
							name: "**Mano del dealer**",
							value: `${gameDealerCards.join(" ")} <:back_card:917518009575276635>\n\nValor: ${cardsValue(
								gameDealerCards,
								cardsGame
							)}`,
							inline: true,
						},
					])
					.setColor(0x3a9f4),
			],
			components: [...buttons],
		})
		.catch(() => null);
	const msgSplit = await (interaction.channel as TextChannel).send({
		embeds: [
			new EmbedBuilder()
				.setDescription(usage.join("\n"))
				.addFields([
					{
						name: "**Tu mano 2**",
						value: `${otherHand.join(" ")}\n\nValor: ${cardsValue(otherHand, cardsGame)}`,
						inline: true,
					},
					{
						name: "**Mano del dealer**",
						value: `${otherCard.join(" ")} <:back_card:917518009575276635>\n\nValor: ${cardsValue(otherCard, cardsGame)}`,
						inline: true,
					},
				])

				.setColor(0x3a9f4),
		],
		components: [...buttons],
	});
	const check = await checkEmbed(amount, interaction.user.id, msgSplit, {
		cards: [gameCards, gameDealerCards],
		values: [cardsValue(otherHand, cardsGame), cardsValue(otherCard, cardsGame)],
	});
	if (!check) return startGame(msgSplit, gameCards, gameDealerCards, cardsGame, cards, amount, interaction.user.id, interaction, hands);
}

function changeCard(
	cardsPlayer: string[] | null,
	cardsBot: string[] | null,
	cartasJugadas: Collection<string, string | number>,
	cartas: Collection<string, string | number>
) {
	const agregarCartas = (carta: string) => {
		let res = cartas.has(carta);
		if (res) {
			let val = cartas.get(carta);
			cartasJugadas.set(carta, val ?? "");
		}
	};
	cardsPlayer?.forEach(agregarCartas);
	cardsBot?.forEach(agregarCartas);
}

function removeCards(cardsPlayer: string[] | null, cardsBot: string[] | null, cartas: Collection<string, string | number>) {
	cardsPlayer?.forEach((card) => {
		cartas.delete(card);
	});

	cardsBot?.forEach((card) => {
		cartas.delete(card);
	});
}

function parseRelatable(value: number, card: "relatable" | number) {
	return card === "relatable" ? (Number(value) + 11 > 21 ? 1 : 11) : card;
}

function createGames(hands: string[][], cards: Collection<string, number | "relatable">, cardsInGame: Collection<string, number | "relatable">) {
	let newCards = cards.filter((x) => x != cardsInGame.get(hands[0][0]));
	let randomCards = newCards.randomKey(2);
	changeCard(randomCards, null, cardsInGame, cards);
	removeCards(randomCards, null, cards);
	for (let i = 0; i < hands.length; i++) {
		hands[i].push(randomCards[i]);
	}
	return hands;
}

function orderGame(cards: string[]) {
	const carta = cards.find((card) => Aces.includes(card));
	let position = cards.indexOf(carta ?? "");
	return cardsMove(cards, position, cards.length - 1);
}

function cardsMove(array: string[], from: number, to: number) {
	try {
		array = [...array];
		const startIndex = from < 0 ? array.length + from : from;
		if (startIndex >= 0 && startIndex < array.length) {
			const endIndex = to < 0 ? array.length + to : to;
			const [item] = array.splice(from, 1);
			array.splice(endIndex, 0, item);
		}
		return array;
	} catch (e) {
		console.log(e);
	}
}
