import { Guild, EmbedBuilder, TextChannel, RepliableInteraction } from "discord.js";
import { ExtendedClient } from "../client.js";
import { COLORS, getChannel, getChannelFromEnv } from "./constants.js";

const MAX_MENTIONS_PER_MESSAGE = 3; // Define el límite de menciones por mensaje

export async function sendWelcomeMessageProcessor(
	client: ExtendedClient,
	omitList: boolean = true,
	channelId?: string,
	reply?: RepliableInteraction
) {
	const guild = client.guilds.cache.get(process.env.GUILD_ID ?? "") as Guild;
	if (omitList && ExtendedClient.newUsers.size === 0) return;
	const newUserIds = Array.from(ExtendedClient.newUsers);

	const batches: string[][] = [];

	for (let i = 0; i < newUserIds.length; i += MAX_MENTIONS_PER_MESSAGE) {
		batches.push(newUserIds.slice(i, i + MAX_MENTIONS_PER_MESSAGE));
	}

	let firstMessage;
	const staffMembers = [...client.staffMembers, ...client.modMembers];
	// Seleccionar un miembro aleatorio del staff
	const randomStaff = staffMembers[Math.floor(Math.random() * staffMembers.length)];

	if (batches.length === 0) {
		await sendMessage("", guild, randomStaff, channelId, reply);
	}

	for (const batch of batches) {
		const mentions = batch.map((id) => `<@${id}>`).join(", ");

		if (!firstMessage) {
			firstMessage = await sendMessage(mentions, guild, randomStaff, channelId);
		} else {
			((await getChannel(guild, "general")) as TextChannel)
				?.send({
					content: "<:this:906183601245261874>" + mentions,
					reply: {
						messageReference: firstMessage,
						failIfNotExists: false,
					},
				})
				.then(() => console.log(`Mensaje de bienvenida enviado a: ${MAX_MENTIONS_PER_MESSAGE} usuarios más.`))
				.catch((error) => console.error("Error al enviar mensaje de bienvenida en el canal general:", error));
		}

		// Eliminar los usuarios que ya fueron mencionados
		batch.forEach((userId) => ExtendedClient.newUsers.delete(userId));

		await new Promise((resolve) => setTimeout(resolve, 3000));
	}
}

async function sendMessage(content: string, guild: Guild, randomStaff: string, channelId?: string, reply?: RepliableInteraction) {
	const embed = new EmbedBuilder()
		.setColor(COLORS.pyeWelcome)
		.setTitle("¡Bienvenid@s a la comunidad  👋🏻!")
		.setDescription(
			`Nos alegra tenerlos aquí. \nNo olviden leer <#${getChannelFromEnv("reglas")}> y de elegir sus <#${getChannelFromEnv("roles")}>.`
		)
		.setFields([
			{
				name: `Si tienen cualquier **pregunta** hay canales especializados`,
				value:
					`Si no encaja en ninguno de los canales usen <#${getChannelFromEnv("ayuda-general")}> <:arma:996504866673406092> \n\n` +
					"Asegurense de usar un **título descriptivo** y poner la mayor cantidad de **detalles** así su pregunta no es **ignorada**\n\n" +
					`👥   Usen <#${getChannelFromEnv("chatProgramadores")}> para hablar principalmente de programacion y <#${getChannelFromEnv(
						"general"
					)}> para conversar de cualquier otro tema.`,
				inline: false,
			},
			{
				name: ` Y si aún necesitan ayuda...`,
				value: `No dudes en contactar a <@${randomStaff}>, nuestro mejor staff!!! (pero no le digas a los demás)`,
				inline: false,
			},
		])
		.setTimestamp()
		.setFooter({ text: "¡Disfruten tu estancia!" });
	if (reply)
		return await reply
			.reply({ content: content, embeds: [embed] })
			.then((msg) => msg.id)
			.catch((error) => console.error("Error al enviar mensaje de bienvenida:", error));
	return await ((await getChannel(guild, "general", undefined, channelId)) as TextChannel)
		?.send({
			content: content,
			embeds: [embed],
		})
		.then((msg) => {
			console.log(`Mensaje de bienvenida enviado a: ${MAX_MENTIONS_PER_MESSAGE} usuarios.`);
			return msg.id;
		})
		.catch((error) => console.error("Error al enviar mensaje de bienvenida:", error));
}
