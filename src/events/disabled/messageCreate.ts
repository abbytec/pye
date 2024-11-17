import { DMChannel, EmbedBuilder, Events, Guild, GuildMember, Message, PublicThreadChannel, TextChannel, ThreadChannel } from "discord.js";
import { ExtendedClient } from "../../client.ts";
import { COLORS, getChannelFromEnv, getForumIdsFromEnv, getRoleFromEnv } from "../../utils/constants.ts";
import { applyTimeout } from "../../commands/moderation/timeout.ts";
import { Users } from "../../Models/User.ts";
import { getCooldown, setCooldown } from "../../utils/cooldowns.ts";
import { checkRole } from "../../utils/generic.ts";
import { checkHelp } from "../../utils/checkhelp.ts";

const PREFIX = "!"; // Define tu prefijo

export default {
	name: Events.MessageCreate,
	async execute(message: Message) {
		// Evita mensajes de bots o mensajes que no tengan el prefijo
		if (message.author.bot || message.author.system) return;
		const client = message.client as ExtendedClient;

		if (!message.inGuild()) {
			return await (message.channel as DMChannel).send({
				embeds: [
					new EmbedBuilder()
						.setColor(COLORS.pyeLightBlue) // Puedes elegir el color que prefieras
						.setTitle("¡Hola! 👋")
						.setDescription(
							`Actualmente, **no soportamos comandos** a través de **mensajes directos**.\n\n` +
								`Si te encuentras **baneado** o **silenciado** en nuestro servidor, puedes **apelar** en el siguiente enlace:\n` +
								`👉 [Apela aquí](https://discord.gg/F8QxEMtJ3B)`
						)
						.setThumbnail(client.user?.displayAvatarURL() ?? "")
						.setTimestamp()
						.setFooter({ text: "Gracias por entender y por ser parte de nuestra comunidad." }),
				],
			});
		}

		if (message.channel.id !== getChannelFromEnv("logs")) {
			await spamFilter(message, client);
		}

		if (!message.content.startsWith(PREFIX)) {
			if (![getChannelFromEnv("mudae"), getChannelFromEnv("casinoPye")].includes(message.channel.id)) {
				const moneyConfig = (message.client as ExtendedClient).getMoneyConfig(process.env.CLIENT_ID ?? "");
				getCooldown(message.client as ExtendedClient, message.author.id, "farm-text", moneyConfig.text.time).then((time) => {
					if (time > 0) {
						Users.findOneAndUpdate({ id: message.author.id }, { $inc: { cash: moneyConfig.text.coins } }, { upsert: true }).then(
							() => {
								setCooldown(message.client as ExtendedClient, message.author.id, "farm-text", moneyConfig.text.time);
							}
						);
					}
				});

				specificChannels(message);
				checkChannel(message).then((isThankable) => {
					if (isThankable) {
						checkHelp(message);
					}
				});
			}
		} else {
			const commandBody = message.content.slice(PREFIX.length).trim();
			const commandName = commandBody.split(/ +/, 1).shift()?.toLowerCase() ?? "";
			const commandArgs = commandBody.slice(commandName.length).trim();

			// Verifica si el comando existe en la colección de comandos
			const command = client.commands.get(commandName);

			if (!command) {
				message.reply("Ese comando no existe.");
				return;
			}

			// Ejecuta el comando con prefijo
			try {
				if (command.executePrefix) {
					await command.executePrefix(message, commandArgs);
				} else {
					message.reply("Este comando no soporta prefijos.");
				}
			} catch (error) {
				console.error(`Error ejecutando el comando ${commandName}:`, error);
				message.reply("Hubo un error ejecutando ese comando.");
			}
		}
	},
};

async function spamFilter(message: Message<boolean>, client: ExtendedClient) {
	if (message.author.bot) return;
	if (message.content?.length < 8) return;

	const filterList = [
		{ filter: "telegra.ph/Adobe-GRATIS-2024", mute: true },
		{ filter: "steamcommunity.com/gift/", mute: true },
		{ filter: "/freenitro", mute: true },
		{ filter: "https://t.me", mute: false },
		{ filter: "https://telegram.me", mute: false },
	];
	const detectedFilter = filterList.find((item) => message.content.includes(item.filter));

	if (detectedFilter) {
		try {
			await message.delete();
			applyTimeout(
				10000,
				"Spam Filter",
				message.member as GuildMember,
				message.guild?.iconURL({ extension: "gif" }) ?? null,
				message.author
			);
			console.log("Mensaje borrado que contenía texto en la black list");
		} catch (error) {
			console.error("spamFilter: Error al intentar borrar el mensaje:", error);
		}

		const channel = client.channels.cache.get(getChannelFromEnv("logs")) as TextChannel;

		if (channel) {
			await channel.send({
				content: `##spamFilter: \nSe eliminó un mensaje que contenía texto no permitido.\n${message.author}(${message.author.id}) - ${message.channel} \n **spam triggered** : \`${detectedFilter.filter}\``,
			});
		} else {
			console.log("spamFilter: No se encontró el canal.");
		}
	}
}

function specificChannels(msg: Message<boolean>) {
	switch (msg.channel.id) {
		case getChannelFromEnv("recursos"):
			msg.react("💤").catch(() => null);
			msg.react("♻").catch(() => null);
			msg.react("922955890200576001").catch(() => null);
			msg.react("796227219591921704").catch(() => null);
			msg.startThread({ name: `${msg.author.username}'s Thread` });
			checkRole(msg, getRoleFromEnv("granAportador"), 75);
			break;
		case getChannelFromEnv("ofreceServicios"):
		case getChannelFromEnv("proyectosNoPagos"):
			msg.startThread({ name: `${msg.author.username}'s Thread` }).then((thread) => {
				thread.send({
					embeds: [
						new EmbedBuilder()
							.setTitle("¡Evita que te estafen!")
							.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" }))
							.setDescription(
								"Por favor te __recordamos__ tomar todas las precauciones posibles al interactuar en estos canales ya que el staff no puede **intervenir** con estafas. **SOLAMENTE TÚ PUEDES EVITAR SER VÍCTIMA DE UNA ESTAFA.**"
							),
						new EmbedBuilder()
							.setTitle("Recomendaciones")
							.setDescription(
								"• No pagues ni entregues ningún trabajo y/o servicio en su totalidad hasta estar completamente seguro que la otra persona es confiable.\n • Si la publicación no ofrece muchos datos al respecto, debes dudar de la misma o bien puedes reportarla a un moderador.\n• Si tienes pruebas sobre la conducta cuestionable de un usuario, puedes reportarlo para impedirle el acceso a estos canales.\n\nDesde este servidor nos comprometemos a mantener estos canales lo más seguros y ordenados dentro de lo posible, **sin embargo** nuestro rol principal es el de brindar un lugar para que los usuarios puedan visibilizar sus publicaciones. Muchas resoluciones de conflicto *exceden* nuestro alcance y obligaciones, por eso recomendamos encarecidamente tener precaución.\n¡En nombre del Staff agradecemos tu atención!"
							)
							.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" })),
					],
				});
			});
			break;
		case getChannelFromEnv("ofertasDeEmpleos"):
			msg.startThread({ name: `${msg.author.username}'s Thread` }).then((thread) => {
				thread.send({
					content: `Hey ${msg.author.toString()}!`,
					embeds: [
						new EmbedBuilder()
							.setTitle("Protege tu dinero y asegurate de que tu trabajo sea finalizado")
							.setThumbnail((msg.guild as Guild).iconURL({ extension: "gif" }))
							.setDescription(
								"Prueba con nuestra opción <#1099082604252241920>.\nEl servidor se asegurará de que consigas alguien para realizarlo y de resguardar tu dinero hasta que el trabajo finalice."
							),
					],
				});
			});
			break;
		case getChannelFromEnv("memes"):
			msg.react("👍").catch(() => null);
			msg.react("👎").catch(() => null);
			msg.react("⭐").catch(() => null);
			checkRole(msg, getRoleFromEnv("especialistaEnMemes"), 75);
			break;
		case getChannelFromEnv("filosofiaPolitica"):
			checkRole(msg, getRoleFromEnv("granDebatidor"), 75);
			break;
	}
}

/** Check channels to trigger Point Helper system */
async function checkChannel(msg: Message<boolean>) {
	let channelId;
	if (msg.channel.type === 11) channelId = (msg.guild as Guild).channels.resolve((msg.channel as PublicThreadChannel).parentId ?? "")?.id;
	else channelId = msg.channel.id;
	return getForumIdsFromEnv().includes(channelId ?? "");
}
