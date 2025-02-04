import { EmbedBuilder, Events, Invite, TextChannel, GuildMember } from "discord.js";
import { ExtendedClient } from "../client.js";
import { Evento } from "../types/event.js";
import { COLORS, getChannelFromEnv } from "../utils/constants.js";

// Mapa para rastrear la creación de invitaciones por usuario
const inviteTracker = new Map<string, { count: number; timeout: NodeJS.Timeout }>();

export default {
	name: Events.InviteCreate,
	once: false,
	async execute(invite: Invite) {
		const client = invite.client as ExtendedClient;

		// Obtiene el ID del canal desde las variables de entorno
		const channelId = getChannelFromEnv("invitaciones");
		const channel = (client.channels.cache.get(channelId) ?? client.channels.resolve(channelId)) as TextChannel | null;

		// Verifica que el canal exista y sea un canal de texto
		if (!channel?.isTextBased()) return;

		// Intenta obtener el invocador (usuario que creó la invitación)
		let inviterTag = "Desconocido";
		let inviterId: string | null = null;
		try {
			const inviter = await invite.inviter?.fetch().catch(() => undefined);
			if (inviter) {
				inviterTag = inviter.tag;
				inviterId = inviter.id;
			}
		} catch (error) {
			// Si no se puede obtener el invocador, se mantiene "Desconocido"
			console.error("No se pudo obtener el invocador de la invitación:", error);
		}
		if (inviterId) {
			const userKey = inviterId;

			if (!inviteTracker.has(userKey)) {
				// Si el usuario no está en el mapa, lo agrega con un conteo de 1
				inviteTracker.set(userKey, {
					count: 1,
					timeout: setTimeout(() => {
						inviteTracker.delete(userKey);
					}, 60000),
				});
			} else {
				const entry = inviteTracker.get(userKey)!;
				entry.count += 1;

				if (entry.count >= 5) {
					clearTimeout(entry.timeout);
					inviteTracker.delete(userKey);

					try {
						const member = await client.guilds.cache
							.get(process.env.GUILD_ID ?? "")
							?.members.fetch(inviterId)
							.catch(() => undefined);

						await member
							?.timeout(60000, "Creación muy rápida de invitaciones")
							.then(async () => {
								let warnMessage = await channel.send({
									content: `<@${inviterId}> has creado varias invitaciones en poco tiempo y por lo que te bloquearemos unos segundos a modo preventivo.`,
								});
								setTimeout(() => {
									warnMessage.delete().catch(() => null);
								}, 10000);
							})
							.catch((err) => {
								console.error(`No se pudo aplicar el timeout a ${inviterTag}:`, err);
							});
					} catch (err) {
						console.error(`Error al aplicar timeout a ${inviterTag}:`, err);
					}
				} else {
					clearTimeout(entry.timeout);
					entry.timeout = setTimeout(() => {
						inviteTracker.delete(userKey);
					}, 60000);
				}
			}
		}

		// Calcula la expiración de la invitación
		const expiresIn = (invite.maxAge ?? 0) > 0 ? `${Math.floor((invite.maxAge ?? 0) / 86400)} días` : "Nunca";

		// Determina el número máximo de usos
		const maxUses = invite.maxUses === 0 || !invite.maxUses ? "∞" : invite.maxUses.toString();

		// Crea el embed con la información de la invitación
		const embed = new EmbedBuilder()
			.setTitle("Invite created")
			.setColor(COLORS.pyeWelcome)
			.setDescription(
				`**Code:** ${invite.code}\n**Channel:** ${invite.channel?.name} (<#${invite.channel?.id}>)\n**Expires:** ${expiresIn}\n**Max uses:** ${maxUses}`
			)
			.setFooter({ text: `${inviterTag}` })
			.setTimestamp();

		// Envía el embed al canal especificado
		channel.send({ embeds: [embed] }).catch((err) => {
			console.error("Error al enviar el embed de la invitación:", err);
		});
	},
} as Evento;
