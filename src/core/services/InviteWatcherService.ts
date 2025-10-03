import { EmbedBuilder, Events, Invite, TextChannel } from "discord.js";
import { CoreClient } from "../CoreClient.js";
import { IService } from "../IService.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { ExtendedClient } from "../../client.js";

export default class InviteWatcherService implements IService {
	public readonly serviceName = "inviteWatcher";

	private readonly inviteTracker = new Map<string, { count: number; timeout: NodeJS.Timeout }>();

	constructor(private readonly client: CoreClient) {}

	start() {
		this.client.on(Events.InviteCreate, (invite: Invite) => this.onInviteCreate(invite));
	}

	private async onInviteCreate(invite: Invite) {
		const client = invite.client as ExtendedClient;
		const channelId = getChannelFromEnv("invitaciones");
		const channel = (client.channels.cache.get(channelId) ?? client.channels.resolve(channelId)) as TextChannel | null;

		if (!channel?.isTextBased()) return;

		let inviterTag = "Desconocido";
		let inviterId: string | null = null;
		try {
			const inviter = await invite.inviter?.fetch().catch(() => undefined);
			if (inviter) {
				inviterTag = inviter.tag;
				inviterId = inviter.id;
			}
		} catch (error) {
			console.error("No se pudo obtener el invocador de la invitación:", error);
		}

		if (inviterId) {
			const userKey = inviterId;
			if (!this.inviteTracker.has(userKey)) {
				this.inviteTracker.set(userKey, {
					count: 1,
					timeout: setTimeout(() => {
						this.inviteTracker.delete(userKey);
					}, 60000),
				});
			} else {
				const entry = this.inviteTracker.get(userKey)!;
				entry.count += 1;
				if (entry.count >= 5) {
					clearTimeout(entry.timeout);
					this.inviteTracker.delete(userKey);

					try {
						const member = await client.guilds.cache
							.get(process.env.GUILD_ID ?? "")
							?.members.fetch(inviterId)
							.catch(() => undefined);

						await member
							?.timeout(60000, "Creación muy rápida de invitaciones")
							.then(async () => {
								const warnMessage = await channel.send({
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
						this.inviteTracker.delete(userKey);
					}, 60000);
				}
			}
		}

		const expiresIn = (invite.maxAge ?? 0) > 0 ? `${Math.floor((invite.maxAge ?? 0) / 86400)} días` : "Nunca";
		const maxUses = invite.maxUses === 0 || !invite.maxUses ? "∞" : invite.maxUses.toString();

		const embed = new EmbedBuilder()
			.setTitle("Invitación creada")
			.setColor(COLORS.pyeLightBlue)
			.setDescription(
				`**Código:** ${invite.code}\n**Canal:** ${invite.channel?.name} (<#${invite.channel?.id}>)\n**Expira:** ${expiresIn}\n**Usos máximos:** ${maxUses}`
			)
			.setFooter({ text: `${inviterTag}` })
			.setTimestamp();

		channel.send({ embeds: [embed] }).catch((err) => {
			console.error("Error al enviar el embed de la invitación:", err);
		});
	}
}

