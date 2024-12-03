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
	"<:2_clubs:917517033036455956>": 2,
	"<:2_diamonds:917517047162867732>": 2,
	"<:2_hearts:917517059213115422>": 2,
	"<:2_spades:917517069061328946>": 2,
	"<:3_clubs:917517080629223466>": 3,
	"<:3_diamonds:917517092788514866>": 3,
	"<:3_hearts:917517108785598484>": 3,
	"<:3_spades:917517116226306088>": 3,
	"<:4_clubs:917517128507215953>": 4,
	"<:4_diamonds:917517140817489980>": 4,
	"<:4_hearts:917517148673425418>": 4,
	"<:4_spades:917517156441284608>": 4,
	"<:5_clubs:917517170580275260>": 5,
	"<:5_diamonds:917517186124349511>": 5,
	"<:5_hearts:917517203698491412>": 5,
	"<:5_spades:917517221327147018>": 5,
	"<:6_hearts:917517288956121149>": 6,
	"<:6_diamonds:917537622048526417>": 6,
	"<:6_clubs:917537642311217193>": 6,
	"<:6_spades:917537841129619506>": 6,
	"<:7_clubs:917517371546152971>": 7,
	"<:7_diamonds:917517387711016960>": 7,
	"<:7_hearts:917517408787370024>": 7,
	"<:7_spades:917537540922282085>": 7,
	"<:8_clubs:917517528224383058>": 8,
	"<:8_diamonds:917517544041086976>": 8,
	"<:8_hearts:917517559304167485>": 8,
	"<:8_spades:917517594368557066>": 8,
	"<:9_diamonds:917517667697590392>": 9,
	"<:9_hearts:917517686202826782>": 9,
	"<:9_spades:917517710932443166>": 9,
	"<:9_clubs:917537476971749446>": 9,
	"<:10_clubs:917517756398714951>": 10,
	"<:10_hearts:917517806973640726>": 10,
	"<:10_spades:917517827253108807>": 10,
	"<:10_diamonds:917537410785615942>": 10,
	"<:J_clubs:917518083646693438>": 10,
	"<:J_diamonds:917536769430396968>": 10,
	"<:J_spades:917536971260305428>": 10,
	"<:J_hearts:917537022485348434>": 10,
	"<:Q_clubs:917518386601295882>": 10,
	"<:Q_diamonds:917518418750603265>": 10,
	"<:Q_hearts:917518431585181707>": 10,
	"<:Q_spades:917518454813245452>": 10,
	"<:K_diamonds:917518209991725057>": 10,
	"<:K_hearts:917518224625655828>": 10,
	"<:K_spades:917536416798478408>": 10,
	"<:K_clubs:917536705656008754>": 10,
	"<:A_clubs:917537119772213289>": "relatable",
	"<:A_diamonds:917537145315524658>": "relatable",
	"<:A_hearts:917537176001052672>": "relatable",
	"<:A_spades:917537196402176041>": "relatable",
};

export default {
	data: new SlashCommandBuilder()
		.setName("blackjack")
		.setDescription("Juega a las cartas con el bot, quien llegue a estar más cerca sin pasarse u obtenga 21, gana.")
		.addIntegerOption((option) =>
			option.setName("cantidad").setDescription("la cantidad que quieres apostar (Máximo 350)").setRequired(true)
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye"))],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const amount = interaction.options.getInteger("cantidad", true);
			let data = await getOrCreateUser(interaction.user.id);
			if (amount < 0) return replyError(interaction, "Debe ser mayor a 0 claro.");
			if (data.cash < amount) return replyError(interaction, "No tienes suficiente para apostar.");
			if (amount > 350) return replyError(interaction, "No puedes apostar más de 350 PyE Coins.");
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
};

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
	interaction: ChatInputCommandInteraction,
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
	interaction: ChatInputCommandInteraction,
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
	interaction: ChatInputCommandInteraction,
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
