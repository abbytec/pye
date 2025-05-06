import {
	SlashCommandBuilder,
	Collection,
	EmbedBuilder,
	ButtonBuilder,
	ActionRowBuilder,
	TextChannel,
	ButtonInteraction,
	InteractionResponse,
	Message,
} from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { IUserModel, betDone, getOrCreateUser } from "../../Models/User.js";
import { PostHandleable } from "../../types/middleware.js";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { calculateJobMultiplier, getRandomNumber } from "../../utils/generic.js";
import { replyError } from "../../utils/messages/replyError.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { ExtendedClient } from "../../client.js";

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

const buttons = [
	new ActionRowBuilder<ButtonBuilder>().addComponents([
		new ButtonBuilder().setStyle(1).setCustomId("bj-hit").setLabel("Otra"),
		new ButtonBuilder().setStyle(3).setCustomId("bj-stand").setLabel("Quedarse"),
		new ButtonBuilder().setStyle(2).setCustomId("bj-ddown").setLabel("Doblar apuesta"),
		new ButtonBuilder().setStyle(2).setCustomId("bj-split").setLabel("Dividir juego"),
	]),
];

const usage = [
	"`Otra` - toma otra carta.",
	"`Quedarse` - termina el juego.",
	"`Doblar apuesta` - duplica tu apuesta, toma una carta y termina el juego.",
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
	group: "🎮 - Juegos",
	data: new SlashCommandBuilder()
		.setName("blackjack")
		.setDescription("Juega a las cartas con el bot, quien llegue a estar más cerca sin pasarse u obtenga 21, gana.")
		.addIntegerOption((option) => option.setName("cantidad").setDescription("la cantidad que quieres apostar").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), verifyCooldown("blackjack", 1000)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const amount = interaction.options.getInteger("cantidad", true);
			let data = await getOrCreateUser(interaction.user.id);
			if (amount < 0) return replyError(interaction, "Debe ser mayor a 0 claro.");
			if (data.cash < amount) return replyError(interaction, "No tienes suficiente para apostar.");
			if (amount > ExtendedClient.getGamexMaxCoins())
				return replyError(interaction, `No puedes apostar más de ${ExtendedClient.getGamexMaxCoins()} PyE Coins.`);
			if (game.has(interaction.user.id)) return replyError(interaction, "Ya te encuentras jugando.");
			game.add(interaction.user.id);

			// Colección que usaremos para ir registrando las cartas jugadas
			const cardsGame = new Collection<string, "relatable" | number>();

			const gameEmbed = new EmbedBuilder().setColor(0x3a9f4).setAuthor({
				name: interaction.user.tag,
				iconURL: interaction.user.displayAvatarURL({ extension: "png", size: 1024 }),
			});

			// Se crea una copia de las cartas disponibles
			const CARDS: Collection<string, number | "relatable"> = new Collection(Object.entries(STATIC_CARDS));

			const dealerCards = CARDS.randomKey(1);
			const firstCards = CARDS.randomKey(2);
			const dealerValue = dealerCards.reduce((a, b) => a + parseRelatable(a, CARDS.get(b) ?? 0), 0);
			const firstValue = firstCards.reduce((a, b) => a + parseRelatable(a, CARDS.get(b) ?? 0), 0);

			let res = await isBlackJack(firstValue, dealerValue, gameEmbed, data, game, amount, interaction, firstCards, dealerCards);
			if (res) return;

			// La mano del jugador y la del dealer (inicial) se crean como arrays
			let gameCardsArr = [...firstCards];
			let gameDealerCards = [...dealerCards];
			// Para el juego “normal” (sin split) usaremos un array de manos; en caso de split se tendrá 2
			let hands = [[...gameCardsArr]];
			// Registra las cartas ya mostradas
			changeCard(gameCardsArr, gameDealerCards, cardsGame, CARDS);
			removeCards(gameCardsArr, gameDealerCards, CARDS);

			const cardsValueFunc = () => gameCardsArr.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0);
			const dealerCardsValueFunc = () => gameDealerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0);

			gameEmbed.setDescription(usage.join("\n")).addFields([
				{
					name: "**Tu mano**",
					value: `${gameCardsArr.join(" ")}\n\n**Valor:** \`${cardsValueFunc()}\``,
					inline: true,
				},
				{
					name: "**Mano del dealer**",
					value: `${gameDealerCards.join(" ")} <:back_card:1313512667775893608>\n\n**Valor:** \`${dealerCardsValueFunc()}\``,
					inline: true,
				},
				{ name: "\u200b", value: "\u200b", inline: true },
			]);

			// Se arma el panel de botones; si la mano ya tiene más de 2 cartas (por ejemplo, luego de split)
			// se deshabilita el botón de split.
			const buttonsInstance = [
				new ActionRowBuilder<ButtonBuilder>().addComponents([
					new ButtonBuilder().setStyle(1).setCustomId("bj-hit").setLabel("Otra"),
					new ButtonBuilder().setStyle(3).setCustomId("bj-stand").setLabel("Quedarse"),
					new ButtonBuilder().setStyle(2).setCustomId("bj-ddown").setLabel("Doblar apuesta"),
					new ButtonBuilder()
						.setStyle(2)
						.setCustomId("bj-split")
						.setLabel("Dividir juego")
						.setDisabled(
							gameCardsArr.length !== 2 ||
								(gameCardsArr.length === 2 && cardsGame.get(gameCardsArr[0]) !== cardsGame.get(gameCardsArr[1]))
						),
				]),
			];

			const m = await interaction.reply({ embeds: [gameEmbed], components: [...buttonsInstance] });
			const check = await checkEmbed(amount, interaction.user.id, m, {
				cards: [gameCardsArr, gameDealerCards],
				values: [cardsValueFunc(), dealerCardsValueFunc()],
			});
			if (!check) return startGame(m, gameCardsArr, gameDealerCards, cardsGame, CARDS, amount, interaction.user.id, interaction, hands, 1);
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"blackjack",
			[
				{
					name: "cantidad",
					required: true,
				},
			],
			["bj"]
		),
} as Command;

/* ------------------------ Funciones auxiliares ------------------------ */

function cardsValue(cards: string[], cardsGame: Collection<string, number | "relatable">) {
	let newOrder: string[] = [];
	if (cards.some((card) => Aces.includes(card))) newOrder = orderGame(cards) ?? [];
	else newOrder = [...cards];
	return newOrder.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0);
}

/**
 * startGame registra el collector para la jugada de una mano en particular.
 * Se usa el parámetro handNumber para identificar si es la mano 1 o 2 (en caso de split).
 * Se detiene el collector (con collector.stop()) en acciones que finalizan la jugada.
 */
// En la definición de startGame se agrega el parámetro alreadySplit:
function startGame(
	interactionResponse: InteractionResponse<true> | Message,
	playerCards: string[],
	dealerCards: string[],
	cardsGame: Collection<string, number | "relatable">,
	cards: Collection<string, number | "relatable">,
	amount: number,
	userId: string,
	interaction: IPrefixChatInputCommand,
	hands: string[][],
	handNumber: number = 1,
	alreadySplit: boolean = false // <-- NUEVO parámetro (por defecto false)
) {
	const collector = interactionResponse.createMessageComponentCollector({
		filter: (i) => ["bj-hit", "bj-stand", "bj-ddown", "bj-split"].includes(i.customId) && i.user.id === userId,
		time: 60e3,
	});

	collector.on("collect", async (i: ButtonInteraction) => {
		if (!i.deferred) await i.deferUpdate().catch(() => null);
		switch (i.customId) {
			case "bj-hit": {
				const newCard = cards.randomKey(1)[0];
				playerCards.push(newCard);
				changeCard([newCard], null, cardsGame, cards);
				removeCards([newCard], null, cards);
				const currentPlayerValue = playerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0);
				const currentDealerValue = dealerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0);
				const res = await checkEmbed(amount, userId, interactionResponse, {
					cards: [playerCards, dealerCards],
					values: [currentPlayerValue, currentDealerValue],
				});
				if (!res) {
					const gameEmbed = new EmbedBuilder()
						.setDescription(usage.join("\n"))
						.addFields([
							{
								name: handNumber === 1 ? "**Tu mano 1**" : "**Tu mano 2**",
								value: `${playerCards.join(" ")}\n\n**Valor:** \`${currentPlayerValue}\``,
								inline: true,
							},
							{
								name: "**Mano del dealer**",
								value: `${dealerCards.join(" ")} <:back_card:1313512667775893608>\n\n**Valor:** \`${currentDealerValue}\``,
								inline: true,
							},
						])
						.setColor(0x3a9f4);
					return interactionResponse
						.edit({
							embeds: [gameEmbed],
							components: [
								new ActionRowBuilder<ButtonBuilder>().addComponents([
									new ButtonBuilder().setStyle(1).setCustomId("bj-hit").setLabel("Otra"),
									new ButtonBuilder().setStyle(3).setCustomId("bj-stand").setLabel("Quedarse"),
									new ButtonBuilder().setStyle(2).setCustomId("bj-ddown").setLabel("Doblar apuesta"),
									// Aquí se deshabilita split si ya se hizo split o no se cumplen las condiciones
									new ButtonBuilder()
										.setStyle(2)
										.setCustomId("bj-split")
										.setLabel("Dividir juego")
										.setDisabled(
											alreadySplit ||
												playerCards.length !== 2 ||
												cardsGame.get(playerCards[0]) !== cardsGame.get(playerCards[1])
										),
								]),
							],
						})
						.catch(() => null);
				}
				break;
			}
			case "bj-stand": {
				while (dealerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0) < 17) {
					const newCard = cards.randomKey(1)[0];
					dealerCards.push(newCard);
					changeCard([newCard], null, cardsGame, cards);
					removeCards([newCard], null, cards);
				}
				collector.stop(); // Se detiene este collector al finalizar la jugada
				await checkGame(
					amount,
					userId,
					{
						cards: [playerCards, dealerCards],
						values: [
							playerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0),
							dealerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0),
						],
					},
					interactionResponse,
					game
				);
				break;
			}
			case "bj-ddown": {
				amount = amount * 2;
				const extraCard = cards.randomKey(1)[0];
				playerCards.push(extraCard);
				changeCard([extraCard], null, cardsGame, cards);
				removeCards([extraCard], null, cards);
				if (playerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0) < 21) {
					const extra = cards.randomKey(getRandomNumber(2, 3));
					if (Array.isArray(extra)) {
						extra.forEach((card) => {
							changeCard([card], null, cardsGame, cards);
							removeCards([card], null, cards);
							dealerCards.push(card);
						});
					}
				}
				collector.stop(); // Se detiene el collector para esta jugada
				await checkGame(
					amount,
					userId,
					{
						cards: [playerCards, dealerCards],
						values: [
							playerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0),
							dealerCards.reduce((a, b) => a + parseRelatable(a, cardsGame.get(b) ?? 0), 0),
						],
					},
					interactionResponse,
					game
				);
				break;
			}
			case "bj-split": {
				// Bloqueamos la acción si la mano ya fue dividida o no tiene exactamente 2 cartas
				if (playerCards.length !== 2) return;
				if (cardsGame.get(playerCards[0]) !== cardsGame.get(playerCards[1])) return;
				// Se crean dos manos separadas: cada una con una de las cartas originales
				const hand1 = [playerCards[0]];
				const hand2 = [playerCards[1]];
				// Se asigna a cada mano una carta extra
				const extra1 = cards.randomKey(1)[0];
				const extra2 = cards.randomKey(1)[0];
				hand1.push(extra1);
				hand2.push(extra2);
				changeCard([extra1], null, cardsGame, cards);
				removeCards([extra1], null, cards);
				changeCard([extra2], null, cardsGame, cards);
				removeCards([extra2], null, cards);
				const newHands = [hand1, hand2];
				collector.stop(); // Se detiene el collector de la mano original
				// En el split, llamamos a startGame con alreadySplit = true
				await splitGame(interactionResponse, hand1, dealerCards, cardsGame, cards, amount, interaction, newHands, hand2);
				break;
			}
		}
	});

	collector.on("end", () => {
		// Se elimina el usuario del set de juego para esta mano.
		game.delete(userId);
	});
}

/**
 * checkEmbed revisa si se alcanzó o superó 21 y, en ese caso, finaliza la partida.
 */
async function checkEmbed(amount: number, userId: string, msg: InteractionResponse | Message, cards: { cards: string[][]; values: number[] }) {
	const data = await getOrCreateUser(userId);
	const {
		cards: [playerCards, dealerCards],
		values: [playerValue, dealerValue],
	} = cards;
	const user = await msg.client.users.fetch(userId).catch(() => undefined);
	const unEmbed = new EmbedBuilder().setAuthor({
		name: user?.displayName ?? "Desconocido",
		iconURL: user?.displayAvatarURL(),
	});
	if (playerValue >= 21 || dealerValue >= 21) {
		if (playerValue > 21 && dealerValue > 21) {
			unEmbed.setColor(0xff8d01).setDescription("Resultado: Empate. Devolviendo dinero.");
		} else if (playerValue > 21) {
			await betDone(msg, userId, amount, -amount);
			unEmbed.setColor(0xef5350).setDescription(`Resultado: Te excediste por lo que perdiste... ${pyecoin} **${amount}**.`);
		} else {
			const earn = calculateJobMultiplier(data.profile?.job, amount, data.couples);
			await betDone(msg, userId, amount, earn);
			unEmbed.setColor(0x66bb6a).setDescription(`Resultado: ¡Ganaste! ${pyecoin} **${earn}**.`);
		}
		unEmbed.addFields([
			{
				name: "**Tu mano**",
				value: `${playerCards.join(" ")}\n\n**Valor:** \`${playerValue}\``,
				inline: true,
			},
			{
				name: "**Mano del dealer**",
				value: `${dealerCards.join(" ")} <:back_card:1313512667775893608>\n\n**Valor:** \`${dealerValue}\``,
				inline: true,
			},
		]);
		game.delete(userId);
		return msg.edit({ embeds: [unEmbed], components: [...buttonsDisabled] }).catch(() => null);
	} else return null;
}

/**
 * checkGame se invoca al terminar la jugada (Stand o DDown) y calcula el resultado final.
 */
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
	const endGame = new EmbedBuilder().setAuthor({
		name: user?.displayName ?? "Desconocido",
		iconURL: user?.displayAvatarURL(),
	});
	if (playerValue >= 21 || dealerValue >= 21) {
		if (playerValue > 21 && dealerValue > 21) {
			endGame.setColor(0xff8d01).setDescription("Resultado: Empate. Devolviendo dinero.");
		} else if (playerValue > 21) {
			await betDone(msg, userId, amount, -amount);
			endGame.setColor(0xef5350).setDescription(`Resultado: Te excediste por lo que perdiste... ${pyecoin} **${amount}**.`);
		} else if (dealerValue === 21) {
			await betDone(msg, userId, amount, -amount);
			await data.save();
			endGame.setColor(0xef5350).setDescription(`Resultado: Dealer se acerco más. ${pyecoin} **${amount}**.`);
		} else {
			const earn = calculateJobMultiplier(data.profile?.job, amount, data.couples);
			await betDone(msg, userId, amount, earn);
			endGame.setColor(0x66bb6a).setDescription(`Resultado: ¡Ganaste!  ${pyecoin} **${earn}**.`);
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
			await betDone(msg, userId, amount, -amount);
			endGame.setColor(0xef5350).setDescription(`Resultado: Dealer se acerco más. ${pyecoin} **${amount}**.`);
		} else {
			const earn = calculateJobMultiplier(data.profile?.job, amount, data.couples);
			await betDone(msg, userId, amount, earn);
			endGame.setColor(0x66bb6a).setDescription(`Resultado: ¡Ganaste!  ${pyecoin} **${earn}**.`);
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

/**
 * isBlackJack evalúa la situación inmediatamente después de repartir las cartas iniciales.
 */
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
	if (firstValue >= 21 || dealerValue >= 21) {
		if (firstValue === dealerValue) {
			embed.setColor(0xff8d01).setDescription("Resultado: Empate. Devolviendo dinero.");
		} else if (dealerValue == 21) {
			await betDone(interaction, interaction.user.id, amount, -amount);
			await data.save();
			embed.setColor(0xef5350).setDescription(`Resultado: Perdiste... ${pyecoin} **${amount}**.`);
		} else if (firstValue == 21) {
			const earn = calculateJobMultiplier(data.profile?.job, amount, data.couples);
			await betDone(interaction, interaction.user.id, amount, earn);
			embed.setColor(0x66bb6a).setDescription(`Resultado: ¡Ganaste! ${pyecoin} **${earn}**.`);
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
				value: `${dealerCards.join(" ")} <:back_card:1313512667775893608>\n\n**Valor:** ${
					dealerValue == 21 ? "`Blackjack`" : `\`${dealerValue}\``
				}`,
				inline: true,
			},
		]);
		return await interaction.reply({ embeds: [embed], components: [...buttonsDisabled] });
	} else return null;
}

/**
 * splitGame envía dos mensajes independientes (uno para cada mano) y registra
 * dos colectores para que el usuario juegue cada mano de forma separada.
 */
async function splitGame(
	m: InteractionResponse | Message,
	hand1: string[],
	dealerCards: string[],
	cardsGame: Collection<string, number | "relatable">,
	cards: Collection<string, number | "relatable">,
	amount: number,
	interaction: IPrefixChatInputCommand,
	hands: string[][],
	hand2: string[]
) {
	// Actualizamos el mensaje de la primera mano
	await m
		.edit({
			embeds: [
				new EmbedBuilder()
					.setDescription(usage.join("\n"))
					.addFields([
						{
							name: "**Tu mano 1**",
							value: `${hand1.join(" ")}\n\nValor: ${cardsValue(hand1, cardsGame)}`,
							inline: true,
						},
						{
							name: "**Mano del dealer**",
							value: `${dealerCards.join(" ")} <:back_card:1313512667775893608>\n\nValor: ${cardsValue(dealerCards, cardsGame)}`,
							inline: true,
						},
					])
					.setColor(0x3a9f4),
			],
			components: [...buttons],
		})
		.catch(() => null);

	// Se envía un mensaje nuevo para la segunda mano
	const msgSplit = await (interaction.channel as TextChannel).send({
		embeds: [
			new EmbedBuilder()
				.setDescription(usage.join("\n"))
				.addFields([
					{
						name: "**Tu mano 2**",
						value: `${hand2.join(" ")}\n\nValor: ${cardsValue(hand2, cardsGame)}`,
						inline: true,
					},
					{
						name: "**Mano del dealer**",
						value: `${dealerCards.join(" ")} <:back_card:1313512667775893608>\n\nValor: ${cardsValue(dealerCards, cardsGame)}`,
						inline: true,
					},
				])
				.setColor(0x3a9f4),
		],
		components: [...buttons],
	});

	// Se verifica cada mano y se inicia un collector para cada una (de forma independiente)
	const check1 = await checkEmbed(amount, interaction.user.id, m, {
		cards: [hand1, dealerCards],
		values: [cardsValue(hand1, cardsGame), cardsValue(dealerCards, cardsGame)],
	});
	const check2 = await checkEmbed(amount, interaction.user.id, msgSplit, {
		cards: [hand2, dealerCards],
		values: [cardsValue(hand2, cardsGame), cardsValue(dealerCards, cardsGame)],
	});
	if (!check1) {
		// Iniciamos para hand1 con alreadySplit = true para que no se permita dividirla nuevamente
		startGame(m, hand1, dealerCards, cardsGame, cards, amount, interaction.user.id, interaction, hands, 1, true);
	}
	if (!check2) {
		// Iniciamos para hand2 con alreadySplit = true
		startGame(msgSplit, hand2, dealerCards, cardsGame, cards, amount, interaction.user.id, interaction, hands, 2, true);
	}
}

function changeCard(
	cardsPlayer: string[] | null,
	cardsBot: string[] | null,
	cartasJugadas: Collection<string, string | number>,
	cartas: Collection<string, string | number>
) {
	const agregarCartas = (carta: string) => {
		if (cartas.has(carta)) {
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
		console.error(e);
	}
}
