import { Guild, EmbedBuilder, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { getRoleFromEnv, COLORS, getChannel, getChannelFromEnv } from "./constants.ts";

const MAX_MENTIONS_PER_MESSAGE = 3; // Define el límite de menciones por mensaje

export async function sendWelcomeMessageProcessor(client: ExtendedClient) {
	const guild = client.guilds.cache.get(process.env.GUILD_ID ?? "") as Guild;
	if (client.newUsers.size === 0) return;
	const newUserIds = Array.from(client.newUsers);

	const batches: string[][] = [];

	for (let i = 0; i < newUserIds.length; i += MAX_MENTIONS_PER_MESSAGE) {
		batches.push(newUserIds.slice(i, i + MAX_MENTIONS_PER_MESSAGE));
	}
	const staffMembers =
		guild.members.cache
			.filter((member) => member.roles.cache.some((role) => [getRoleFromEnv("staff"), getRoleFromEnv("moderadorChats")].includes(role.id)))
			.map((member) => member.user) || [];

	let firstMessage;

	for (const batch of batches) {
		// Seleccionar un miembro aleatorio del staff
		const randomStaff = staffMembers[Math.floor(Math.random() * staffMembers.length)];

		const mentions = batch.map((id) => `<@${id}>`).join(", ");

		if (!firstMessage) {
			// Crear el embed
			const embed = new EmbedBuilder()
				.setColor(COLORS.pyeWelcome)
				.setTitle("¡Bienvenid@s a la comunidad  👋🏻!")
				.setDescription(`Nos alegra tenerlos aquí. `)
				.setFields([
					{
						name: `Si tienen cualquier **pregunta **hay canales especializados`,
						value:
							`Si no encaja en ninguno de los canales usen <#${getChannelFromEnv(
								"ayuda-general"
							)}> <:arma:996504866673406092>\n\n` +
							"Asegurense de usar un **título descriptivo** y poner la mayor cantidad de **detalles** así su pregunta no es *ignorada**\n\n" +
							`👥   Usen <#${getChannelFromEnv(
								"chatProgramadores"
							)}> para hablar principalmente de programacion y <#${getChannelFromEnv(
								"general"
							)} para conversar de cualquier otro tema.`,
						inline: false,
					},
					{
						name: ` Y si aún necesitas ayuda...`,
						value: `No dudes en contactar a ${randomStaff}!!! nuestro mejor staff (pero no le digas a los demás)`,
						inline: false,
					},
				])
				.setTimestamp()
				.setFooter({ text: "¡Disfruten tu estancia!" });
			firstMessage = await ((await getChannel(guild, "general")) as TextChannel)
				?.send({
					content: mentions,
					embeds: [embed],
				})
				.then((msg) => {
					console.log(`Mensaje de bienvenida enviado a: ${MAX_MENTIONS_PER_MESSAGE} usuarios.`);
					return msg.id;
				})
				.catch((error) => console.error("Error al enviar mensaje de bienvenida en el canal general:", error));
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
		batch.forEach((userId) => client.newUsers.delete(userId));

		await new Promise((resolve) => setTimeout(resolve, 3000));
	}
}
