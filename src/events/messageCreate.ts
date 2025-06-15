import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ChannelType,
	DMChannel,
	EmbedBuilder,
	Events,
	Guild,
	Message,
	PublicThreadChannel,
	Sticker,
	StickerType,
	TextChannel,
} from "discord.js";
import { ExtendedClient } from "../client.js";
import {
	AUTHORIZED_BOTS,
	COLORS,
	commandProcessingLimiter,
	DISBOARD_UID,
	EMOJIS,
	getChannelFromEnv,
	getHelpForumsIdsFromEnv,
	getRoleFromEnv,
	messagesProcessingLimiter,
	PREFIX,
} from "../utils/constants.js";
import { Users } from "../Models/User.js";
import { getCooldown, setCooldown } from "../utils/cooldowns.js";
import { checkRole, convertMsToUnixTimestamp } from "../utils/generic.js";
import { checkHelp } from "../utils/checkhelp.js";
import { bumpHandler } from "../utils/messages/handlers/bumpHandler.js";

import { messageGuard } from "../security/messageGuard.js";
import { hashMessage } from "../security/messageHashing.js";
import { checkQuestLevel, IQuest } from "../utils/quest.js";
import { ParameterError } from "../interfaces/IPrefixChatInputCommand.js";
import { manageAIResponse } from "../utils/ai/aiRequestHandler.js";
import { checkCooldownComparte } from "../security/checkCooldownComparte.js";
import AIUsageControlService from "../core/services/AIUsageControlService.js";
import CommandService from "../core/services/CommandService.js";
import ForumPostControlService from "../core/services/ForumPostControlService.js";
import TrendingService from "../core/services/TrendingService.js";

export default {
	name: Events.MessageCreate,
	async execute(message: Message) {
		if (AUTHORIZED_BOTS.includes(message.author.id)) return;
		if (bumpHandler(message)) return;

		const client = message.client as ExtendedClient;

		if (!message.inGuild()) {
			client.guilds.cache
				.get(process.env.GUILD_ID ?? "")
				?.members.fetch(message.author.id)
				.then(async (member) => {
					if (member.roles.cache.has(getRoleFromEnv("colaborador"))) {
						if (AIUsageControlService.checkDailyAIUsageDM(message.author.id)) await manageAIResponse(message, undefined, true);
						else member.user.send("Has alcanzado el límite de uso diario de la IA. Por favor espera hasta mañana 💙");
					} else
						await (message.channel as DMChannel).send({
							embeds: [
								new EmbedBuilder()
									.setColor(COLORS.pyeLightBlue) // Puedes elegir el color que prefieras
									.setTitle("¡Hola! 👋")
									.setDescription(
										`Actualmente, **no soportamos comandos** a través de **mensajes directos**.\n\n` +
											`Si te encuentras **baneado** o **silenciado** en nuestro servidor, puedes **apelar** en el siguiente enlace:\n` +
											`👉 [Apela aquí](https://discord.gg/F8QxEMtJ3B)\n\n` +
											`Si deseas chatear con la IA debes tener \`.gg/programación\` en tu estado de discord.`
									)
									.setThumbnail(client.user?.displayAvatarURL() ?? "")
									.setTimestamp()
									.setFooter({ text: "Gracias por entender y por ser parte de nuestra comunidad." }),
							],
						});
				});
		} else {
			if (await messageGuard(message, client)) return;
			if (message.author.bot || message.author.system) return;

			if (!message.content.startsWith(PREFIX)) {
				messagesProcessingLimiter.schedule(async () => await processCommonMessage(message, client));
			} else {
				commandProcessingLimiter.schedule(async () => await processPrefixCommand(message, client));
			}
		}
	},
};

async function processCommonMessage(message: Message, client: ExtendedClient) {
	let checkingChanel;
	if (![getChannelFromEnv("mudae"), getChannelFromEnv("casinoPye")].includes(message.channel.id)) {
		const moneyConfig = client.services.economy.getConfig(process.env.CLIENT_ID ?? "");
		getCooldown(client, message.author.id, "farm-text", moneyConfig.text.time).then(async (time) => {
			if (time > 0) {
				Users.findOneAndUpdate({ id: message.author.id }, { $inc: { cash: moneyConfig.text.coins } }, { upsert: true, new: true })
					.exec()
					.then(() => {
						setCooldown(client, message.author.id, "farm-text", moneyConfig.text.time);
					});
			}
		});

		checkQuestLevel({ msg: message, text: 1, userId: message.author.id } as IQuest);

		await specificChannels(message, client);
		checkingChanel = checkThanksChannel(message);
		if (checkingChanel && (await checkUserThanking(message))) {
			checkHelp(message);
		}
		registerNewTrends(message, client);
		manageAIResponse(message, checkingChanel);
	}
}

async function processPrefixCommand(message: Message, client: ExtendedClient) {
	const commandBody = message.content.slice(PREFIX.length).trim();
	const commandName = commandBody.split(/ +/, 1).shift()?.toLowerCase() ?? "";

	// Verifica si el comando existe en la colección de comandos
	const command = CommandService.prefixCommands.get(commandName);

	if (!command) {
		message.reply("Ese comando no existe, quizá se actualizó a Slash Command :point_right: /.\n Prueba escribiendo /help.");
		return;
	}

	try {
		const parsedMessage = await command.parseMessage(message);
		if (parsedMessage) {
			let commandFunction = CommandService.commands.get(command.commandName);
			if (commandFunction) {
				commandFunction.execute(parsedMessage);
				if (!commandFunction?.group) return;
				if (commandFunction.group.toLowerCase().includes("juegos")) {
					await checkRole(message, getRoleFromEnv("granApostador"), 75, "apostador");
				}
			} else {
				ExtendedClient.logError("Comando no encontrado: " + command.commandName, undefined, message.author.id);
			}
		} else {
			message.reply({ content: "Hubo un error ejecutando ese comando.", ephemeral: true } as any).catch(() => null);
		}
	} catch (error: any) {
		if (!(error instanceof ParameterError)) {
			console.error(`Error ejecutando el comando ${commandName}:`, error);
		}
		message.reply({ content: "Hubo un error ejecutando ese comando.\n" + error.message, ephemeral: true } as any).catch(() => null);
	}
}

const employmentsDescription =
	"• No pagues ni entregues ningún trabajo y/o servicio en su totalidad hasta estar completamente seguro que la otra persona es confiable.\n" +
	"• Sugerímos realizar pagos pequeños por hitos, es decir, entregables pequeños que muestren un avance real. Asi como pactar previamente comisiones externas como por ejemplo, si el monto a transferir incluye impuestos o estos se contabilizan aparte.\n" +
	"• Si la publicación no ofrece muchos datos al respecto, debes dudar de la misma o bien puedes reportarla a un moderador.\n" +
	"• Si tienes pruebas sobre la conducta cuestionable de un usuario, puedes reportarlo para impedirle el acceso a estos canales.\n" +
	"\nDesde este servidor nos comprometemos a mantener estos canales lo más seguros y ordenados dentro de lo posible, **sin embargo** nuestro rol principal es el de brindar un lugar para que los usuarios puedan visibilizar sus publicaciones. Muchas resoluciones de conflicto *exceden* nuestro alcance y obligaciones, por eso recomendamos encarecidamente tener precaución.\n¡En nombre del Staff agradecemos tu atención!";

const repoRegex =
	/(?:https?:\/\/)?(?:www\.)?(?:(?:(?:github\.com|gitlab\.com|bitbucket\.org|codecommit\.amazonaws\.com)[^\s]*)|(?:git\.[^\s]+)|(?:[^\s]+\.git))/i;
const redesRegex = /https:\/\/[^\s]+\//gim;
const finishEnrollmentsBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
	new ButtonBuilder().setCustomId("finish_enrollments").setLabel("Cerrar Convocatorias").setStyle(ButtonStyle.Danger)
);
async function specificChannels(msg: Message<boolean>, client: ExtendedClient) {
	switch (msg.channel.id) {
		case getChannelFromEnv("recursos"):
			msg.react("👍").catch(() => null);
			msg.react("👎").catch(() => null);
			msg.react("⭐").catch(() => null);
			msg.startThread({ name: `Hilo de ${msg.author.username}` });
			checkRole(msg, getRoleFromEnv("granAportador"), 50);
			break;
		case getChannelFromEnv("ofreceServicios"):
		case getChannelFromEnv("ofertasDeEmpleos"): {
			checkCooldownComparte(msg, client).then(async (cooldown) => {
				if (!cooldown) {
					msg.startThread({ name: `${msg.author.username} - Empleo` })
						.then((thread) => {
							thread.send({
								embeds: [
									new EmbedBuilder()
										.setTitle("Protege tu dinero y asegurate de que tu trabajo sea finalizado")
										.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" }))
										.setDescription(
											"Por favor te __recordamos__ tomar todas las precauciones posibles al interactuar en estos canales ya que el staff no puede **intervenir** con estafas. **SOLAMENTE TÚ PUEDES EVITAR SER VÍCTIMA DE UNA ESTAFA.**"
										),
									new EmbedBuilder()
										.setTitle("Recomendaciones")
										.setDescription(employmentsDescription)
										.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" })),
								],
								components: [finishEnrollmentsBtn],
							});
						})
						.catch(() => null);
					await setCooldown(client, msg.author.id, "comparte-post", 1000 * 60 * 60 * 24 * 7);
				}
			});
			break;
		}
		case getChannelFromEnv("proyectosNoPagos"): {
			checkCooldownComparte(msg, client).then(async (cooldown) => {
				if (!cooldown) {
					msg.startThread({ name: `${msg.author.username} - Proyecto` })
						.then((thread) => {
							thread.send({
								content: `Hey ${msg.author.toString()}!`,
								embeds: [
									new EmbedBuilder()
										.setTitle("¡Evita que te estafen!")
										.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" }))
										.setDescription(
											"Por favor te __recordamos__ tomar todas las precauciones posibles al interactuar en estos canales ya que el staff no puede **intervenir** con estafas. **SOLAMENTE TÚ PUEDES EVITAR SER VÍCTIMA DE UNA ESTAFA.**"
										),
								],
								components: [finishEnrollmentsBtn],
							});
						})
						.catch(() => null);
					await setCooldown(client, msg.author.id, "comparte-post", 1000 * 60 * 60 * 24 * 7);
				}
			});
			break;
		}
		case getChannelFromEnv("memes"):
			msg.react("💤").catch(() => null);
			msg.react("♻️").catch(() => null);
			msg.react("<:xdlol:922955890200576001>").catch(() => null);
			msg.react("<:KEKW:796227219591921704>").catch(() => null);
			checkRole(msg, getRoleFromEnv("especialistaEnMemes"), 75);
			break;
		case getChannelFromEnv("filosofiaPolitica"):
			checkRole(msg, getRoleFromEnv("granDebatidor"), 500);
			break;
		case getChannelFromEnv("openSource"):
			if (!repoRegex.test(msg.content)) {
				try {
					await msg.delete();
					if (msg.channel.isSendable()) {
						const aviso = await msg.channel.send(
							`${msg.author}, tu mensaje ha sido eliminado porque debe incluir un enlace a un repositorio.`
						);
						setTimeout(() => {
							aviso.delete().catch(console.error);
						}, 5000);
					}
				} catch (error) {
					console.error("Error al procesar el mensaje:", error);
				}
			}
			break;
		case getChannelFromEnv("gruposDeEstudio"):
			msg.startThread({ name: `Grupo de ${msg.author.username}` }).catch(() => null);
			break;
		case getChannelFromEnv("linkedin"):
			if (msg.content.match(redesRegex)) {
				msg.startThread({ name: `Comentarios sobre mi página` }).catch(() => null);
			} else {
				let warn = await (msg.channel as TextChannel).send({
					content: `🚫 <@${msg.author.id}>Por favor, incluye un enlace a tu perfil/portafolio en el mensaje.`,
				});
				await msg.delete().catch(() => null);
				setTimeout(async () => await warn.delete().catch(() => null), 10000);
			}
			break;
	}
}

/** Check user to trigger Point Helper system */
async function checkUserThanking(msg: Message<boolean>) {
	if (msg.channel.type === ChannelType.PublicThread) {
		const threadAuthor = await (msg.channel as PublicThreadChannel).fetchOwner().catch(() => null);
		return threadAuthor?.id === msg.author.id;
	} else return msg.reference;
}

/** Check channels to trigger Point Helper system */
function checkThanksChannel(msg: Message<boolean>) {
	let channelId: string | undefined = undefined;
	if (msg.channel.type === ChannelType.PublicThread) {
		channelId = (msg.channel as PublicThreadChannel).parentId ?? undefined;
	} else {
		channelId = msg.channel.id;
	}
	return [...getHelpForumsIdsFromEnv(), getChannelFromEnv("chatProgramadores")].includes(channelId ?? "") ? channelId : undefined;
}

async function registerNewTrends(message: Message<boolean>, client: ExtendedClient) {
	message.stickers.forEach(async (sticker: Sticker) => {
		if ((await TrendingService.getStickerType(sticker)) === StickerType.Guild) client.services.trending.add("sticker", sticker.id);
	});
	const emojiIds =
		[...message.content.matchAll(/<(a?:\w+:\d+)>/g)].map((match) => (match[1].startsWith(":") ? match[1].slice(1) : match[1])) || [];
	emojiIds.forEach((emojiId: string) => {
		client.services.trending.add("emoji", emojiId);
	});
}
