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
	getChannelFromEnv,
	getHelpForumsIdsFromEnv,
	getRoleFromEnv,
	messagesProcessingLimiter,
	PREFIX,
} from "../utils/constants.js";
import { setCooldown } from "../utils/cooldowns.js";
import { checkRole } from "../utils/generic.js";
import { bumpHandler } from "../utils/messages/handlers/bumpHandler.js";

import { messageGuard } from "../security/messageGuard.js";
import { manageAIResponse } from "../utils/ai/aiRequestHandler.js";
import { checkCooldownComparte } from "../security/checkCooldownComparte.js";
import AIUsageControlService from "../core/services/AIUsageControlService.js";
import TrendingService from "../core/services/TrendingService.js";
import { scanFile, ScanResult } from "../utils/scanFile.js";

export default {
	name: Events.MessageCreate,
	async execute(message: Message) {
		const client = message.client as ExtendedClient;
		if (message.author.bot || message.author.system) {
			if (AUTHORIZED_BOTS.includes(message.author.id)) bumpHandler(message);
			else if (message.inGuild()) messageGuard(message, client);
			return;
		}

		if (message.inGuild()) {
			if (await messageGuard(message, client)) return;
			if (!message.content.startsWith(PREFIX) && message.channel.id !== getChannelFromEnv("casino")) {
				messagesProcessingLimiter.schedule(async () => {
					specificChannels(message, client);
					registerNewTrends(message, client);
					manageAIResponse(message, checkThanksChannel(message));
				});
			}
		} else {
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
											`👉 [Apela aquí](https://discord.gg/CsjZVuWK84)\n\n` +
											`Si deseas chatear con la IA debes tener \`.gg/programación\` en tu estado de discord.\n` +
											`Puedes comunicarte con la administración del servidor mediante un ticket en <#${getChannelFromEnv(
												"tickets"
											)}>.`
									)
									.setThumbnail(client.user?.displayAvatarURL() ?? "")
									.setTimestamp()
									.setFooter({ text: "Gracias por entender y por ser parte de nuestra comunidad." }),
							],
						});
				});
		}
	},
};

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
						.then(async (thread) => {
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

							if (msg.attachments.size > 0) {
								const scans = new Map<string, ScanResult>();

								await Promise.all(
									[...msg.attachments.values()].map(async (attachment) => {
										const result = await checkAttachment(attachment.url);
										scans.set(attachment.url, result);
									})
								);

								const totalFiles = scans.size;
								const infectedFiles = Array.from(scans.values()).filter((r) => r.is_infected).length;
								const infectedRatio = infectedFiles / totalFiles;

								let color: "Red" | "Yellow" | "Green" = "Green";
								if (infectedRatio > 0.5) {
									color = "Red";
								} else if (infectedRatio > 0) {
									color = "Yellow";
								}

								const embed = new EmbedBuilder()
									.setTitle("🧪 Escaneo de archivos adjuntos")
									.setColor(color)
									.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" }))
									.setFooter({
										text: `Total: ${totalFiles} | Infectados: ${infectedFiles} | Limpios: ${totalFiles - infectedFiles}`,
										iconURL: "https://cdn-icons-png.flaticon.com/512/942/942751.png",
									});

								let description = "";

								scans.forEach((result, url) => {
									const fileName = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "archivo");
									const estado = result.is_infected ? "⚠️ Infectado" : "✅ Limpio";
									const virusList =
										result.is_infected && result.viruses.length ? `\n**Virus:** ${result.viruses.join(", ")}` : "";

									description += `**[${fileName}](${url})**\n**Estado:** ${estado}${virusList}\n\n`;
								});

								embed.setDescription(description);

								thread.send({ embeds: [embed] });
							}
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
				const warn = await (msg.channel as TextChannel).send({
					content: `🚫 <@${msg.author.id}>Por favor, incluye un enlace a tu perfil/portafolio en el mensaje.`,
				});
				await msg.delete().catch(() => null);
				setTimeout(async () => await warn.delete().catch(() => null), 10000);
			}
			break;
	}
}

/** Check user to trigger Point Helper system */
/* async function checkUserThanking(msg: Message<boolean>) {
	if (msg.channel.type === ChannelType.PublicThread) {
		const threadAuthor = await (msg.channel as PublicThreadChannel).fetchOwner().catch(() => null);
		return threadAuthor?.id === msg.author.id;
	} else return msg.reference;
} */

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

export async function checkAttachment(url: string) {
	try {
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Failed to fetch file: ${response.statusText}`);
		}

		const arrayBuff = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuff);

		const upload = {
			name: url.split("/").pop() || "file",
			size: buffer.length,
			data: buffer,
		};

		const result = await scanFile(upload);
		return result;
	} catch (error) {
		console.error("Error scanning file:", error);
		return {
			name: url.split("/").pop() || "file",
			is_infected: true,
			viruses: ["No se pudo analizar el archivo"],
		};
	}
}
