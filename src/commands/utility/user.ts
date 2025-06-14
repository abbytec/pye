// src/commands/General/user.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, User } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { COLORS } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

// Mapeo de estados de presencia
const statusMap: Record<string, string> = {
	online: "En línea.",
	offline: "Desconectado.",
	idle: "Afk.",
	dnd: "No molestar.",
};

// Mapeo de badges con descripciones cortas (si decides mantener alguno en el futuro)
const badges: Record<string, string> = {
	HOUSE_BALANCE: "<:BALANCE:1313345170061660210>",
	EARLY_VERIFIED_BOT_DEVELOPER: "<:BOT_DEV:1313345164911185962>",
	HOUSE_BRAVERY: "<:BRAVERY:1313345168199651401>",
	HOUSE_BRILLIANCE: "<:BRILLIANCE:1313345166698086430>",
	BUGHUNTER_LEVEL_1: "<:BUG_HUNTER_1:1313358713469534278>",
	BUGHUNTER_LEVEL_2: "<:BUG_HUNTER_2:1313358710755561543>",
	DISCORD_CERTIFIED_MODERATOR: "<:CERTIFIED_MODERATOR:1313358714580762657>",
	DISCORD_EMPLOYEE: "<:DISCORD_EMPLOYEE:1313345163766272030>",
	EARLY_SUPPORTER: "<:EARLY_SUPPORTER:1313345162063380530>",
	HYPESQUAD_EVENTS: "<:HYPESQUAD_EVENTS:1313358712181624853>",
	PARTNERED_SERVER_OWNER: "<:PARTNER:1313340712024018985>",
	VERIFIED_BOT: "<:VERIFIED_BOT:1313345171861274644>",
};

export default {
	data: new SlashCommandBuilder()
		.setName("user")
		.setDescription("Muestra información de un usuario de Discord.")
		.addUserOption((option) =>
			option.setName("usuario").setDescription("El usuario del cual quieres obtener información.").setRequired(false)
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			let targetUser: User = (await interaction.options.getUser("usuario")) ?? interaction.user;
			let userWithData: Promise<User> | User = targetUser.fetch(true);
			const member = await interaction.guild?.members.fetch(targetUser.id).catch(() => null);

			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario especificado en el servidor.");

			try {
				// Construir los campos de información del usuario
				let banner;
				userWithData = await userWithData;
				console.log(userWithData.banner, userWithData.bannerURL());
				if (userWithData.banner) {
					banner = `[Clic aqui.](${userWithData.bannerURL({ size: 1024 })})`;
				} else if (userWithData.hexAccentColor) {
					banner = `[Clic aqui.](https://dummyimage.com/600x121/${userWithData.hexAccentColor.replace(
						"#",
						""
					)}/${userWithData.hexAccentColor.replace("#", "")}.png)`;
				} else {
					banner = "No tiene.";
				}
				const userInfoFields = [
					{
						name: "**❥ Username:**",
						value: `${targetUser.username}`,
						inline: true,
					},
					{
						name: "**❥ Avatar:**",
						value: `[Clic aquí.](${targetUser.displayAvatarURL({
							size: 1024,
						})})`,
						inline: false,
					},
					{
						name: "**❥ Banner:**",
						value: banner,
						inline: false,
					},
					{
						name: "**❥ Tiempo en Discord:**",
						value: `<t:${Math.floor(targetUser.createdAt.getTime() / 1000)}:R>`,
						inline: false,
					},
				];

				// Si el miembro existe en el servidor, agregar información adicional
				if (member) {
					userInfoFields.push(
						{
							name: "**❥ Estatus:**",
							value: member.presence ? statusMap[member.presence.status] || "Desconocido." : "Desconectado.",
							inline: true,
						},
						{
							name: "**❥ Tiempo en el servidor:**",
							value: `<t:${Math.floor(member.joinedAt!.getTime() / 1000)}:R>`,
							inline: true,
						}
					);
				}

				// Crear el embed de información del usuario
				const embed = new EmbedBuilder()
					.setAuthor({
						name: `${targetUser.username}'s info`,
						iconURL: targetUser.displayAvatarURL(),
					})
					.setThumbnail(targetUser.displayAvatarURL())
					.addFields(userInfoFields)
					.setImage(targetUser.bannerURL({ size: 1024 }) ?? null)
					.setFooter({
						text: `Pedido por: ${interaction.user.username}`,
						iconURL: interaction.user.displayAvatarURL(),
					})
					.setColor(COLORS.okGreen)
					.setTimestamp();

				// Enviar el embed como respuesta
				await replyOk(interaction, [embed]);
			} catch (error) {
				console.error("Error al obtener información del usuario:", error);
				return await replyError(interaction, "Hubo un error al obtener la información del usuario.");
			}
		}
	),
} as Command;
