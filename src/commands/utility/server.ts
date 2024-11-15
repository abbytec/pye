// src/commands/General/server.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildFeature, Guild, User } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";

// Mapeo correcto de niveles de boost
const levels: Record<number, string> = {
	0: "No tiene.",
	1: "Nivel 1.",
	2: "Nivel 2.",
	3: "Nivel 3.",
};

// Mapeo de características del servidor
const features: Record<GuildFeature, string> = {
	VANITY_URL: "Invitación personalizada.",
	PARTNERED: "Partner",
	PRIVATE_THREADS: "Hilos privados",
	INVITE_SPLASH: "Invitación con splash.",
	MEMBER_VERIFICATION_GATE_ENABLED: "Verificación de miembros.",
	PREVIEW_ENABLED: "Revisualizar el servidor.",
	NEWS: "Canales de anuncios.",
	ANIMATED_BANNER: "Banner animado.",
	COMMUNITY: "Comunidad abierta.",
	ANIMATED_ICON: "Icono animado.",
	VIP_REGIONS: "Regiones VIP",
	DISCOVERABLE: "Descubrimiento del servidor activado.",
	ROLE_ICONS: "Icono en los roles.",
	BANNER: "Un banner.",
	APPLICATION_COMMAND_PERMISSIONS_V2: "Permisos avanzados para comandos.",
	AUTO_MODERATION: "Moderación automática.",
	CREATOR_MONETIZABLE_PROVISIONAL: "Monetización provisional.",
	CREATOR_STORE_PAGE: "Página de tienda de creadores.",
	DEVELOPER_SUPPORT_SERVER: "Soporte para desarrolladores.",
	FEATURABLE: "Puede ser destacado.",
	HAS_DIRECTORY_ENTRY: "Listo en el directorio.",
	HUB: "Centro de actividades.",
	INVITES_DISABLED: "Invitaciones deshabilitadas.",
	LINKED_TO_HUB: "Vinculado a un hub.",
	MONETIZATION_ENABLED: "Monetización habilitada.",
	MORE_STICKERS: "Más stickers disponibles.",
	RAID_ALERTS_DISABLED: "Alertas de raid deshabilitadas.",
	RELAY_ENABLED: "Relay habilitado.",
	ROLE_SUBSCRIPTIONS_AVAILABLE_FOR_PURCHASE: "Suscripciones de roles a la venta.",
	ROLE_SUBSCRIPTIONS_ENABLED: "Suscripciones de roles activadas.",
	TICKETED_EVENTS_ENABLED: "Eventos con entradas habilitados.",
	VERIFIED: "Servidor verificado.",
	WELCOME_SCREEN_ENABLED: "Pantalla de bienvenida activada.",
};

export default {
	data: new SlashCommandBuilder().setName("server").setDescription("Muestra información detallada del servidor."),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const guild = interaction.guild as Guild;

			try {
				// Obtener el propietario del servidor
				const owner: User = (await guild.fetchOwner()).user;

				// Obtener canales, emojis, stickers y miembros
				const channels = guild.channels.cache;
				const emojis = guild.emojis.cache;
				const stickers = guild.stickers.cache;
				const members = guild.members.cache;

				// Contar tipos de canales
				const textChannels = channels.filter((c) => c.isTextBased()).size;
				const voiceChannels = channels.filter((c) => c.isVoiceBased()).size;
				const threadChannels = channels.filter((c) => c.isThread()).size;

				// Contar estados de miembros
				const totalMembers = members.size;
				const onlineMembers = members.filter((m) => m.presence?.status === "online").size;
				const dndMembers = members.filter((m) => m.presence?.status === "dnd").size;
				const idleMembers = members.filter((m) => m.presence?.status === "idle").size;
				const offlineMembers = members.filter((m) => !m.presence).size;

				// Formatear fecha de creación
				const creationDate = `<t:${Math.floor(guild.createdAt.getTime() / 1000)}:R>`;

				// Obtener roles
				const rolesCount = guild.roles.cache.size;

				// Obtener Splash y Banner
				const splash = guild.splash ? `[Clic aquí](${guild.splashURL()})` : "No tiene.";
				const banner = guild.banner ? `[Clic aquí](${guild.bannerURL()})` : "No tiene.";

				// Obtener nivel de boost y características
				const premiumTier = levels[guild.premiumTier] ?? "Desconocido";
				const boostCount = guild.premiumSubscriptionCount;
				const mappedFeatures =
					guild.features
						.map((f) => features[f as GuildFeature])
						.filter((f): f is string => f !== undefined)
						.join(" **|** ") || "No tiene.";

				// Obtener emojis (limitados a 5)
				const displayedEmojis =
					emojis.size > 5
						? `${emojis
								.first(5)
								?.map((e) => e.toString())
								.join(", ")} **...+${emojis.size - 5}**`
						: emojis.map((e) => e.toString()).join(", ");

				// Crear el embed
				const embed = new EmbedBuilder()
					.setAuthor({
						name: guild.name,
						iconURL: guild.iconURL() ?? undefined,
					})
					.setThumbnail(guild.iconURL() ?? null)
					.setFooter({
						text: interaction.user.username,
						iconURL: interaction.user.displayAvatarURL(),
					})
					.setColor(0x00ff00)
					.setTimestamp()
					.addFields(
						{
							name: "• Propietario",
							value: `<:6632serverowner:935013107946889267> ${owner.username}`,
						},
						{
							name: "Descripción",
							value: guild.description ? guild.description : "No tiene.",
						},
						{
							name: "• Emojis y Stickers",
							value: `Emojis: ${displayedEmojis}\nStickers: ${stickers.size}`,
						},
						{
							name: "• Canales",
							value: `<:1153lockedtextchannel:935009804966035516> Texto: ${textChannels}\n<:3025lockedvc:935009792576077865> Voz: ${voiceChannels}\n<:5001threadchannel:935009784493645844> Hilos: ${threadChannels}`,
							inline: true,
						},
						{
							name: "• Miembros",
							value: `Total: ${totalMembers}\nEn línea: ${onlineMembers}\nNo molestar: ${dndMembers}\nAusente: ${idleMembers}\nDesconectado: ${offlineMembers}`,
							inline: true,
						},
						{
							name: "• Fecha de creación",
							value: creationDate,
						},
						{
							name: "• Roles",
							value: `${rolesCount}`,
							inline: true,
						},
						{
							name: "• Splash",
							value: splash,
							inline: true,
						},
						{
							name: "• Banner",
							value: banner,
							inline: true,
						},
						{
							name: "• Boost",
							value: `<:thonkeyes:913096578879868979> Nivel de boost: ${premiumTier}\n<:3874boostwithsparkles:935020482435104788> Boost: ${boostCount}\n<:PARTNER:933594339047768094> Características: ${mappedFeatures}`,
						}
					);

				// Enviar el embed como respuesta
				await replyOk(interaction, [embed]);
			} catch (error) {
				console.error("Error al obtener información del servidor:", error);
				return await replyError(interaction, "Hubo un error al obtener la información del servidor.");
			}
		}
	),
};
