// src/commands/General/user.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, User } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";

// Mapeo de estados de presencia
const statusMap: Record<string, string> = {
	online: "En línea.",
	offline: "Desconectado.",
	idle: "Afk.",
	dnd: "No molestar.",
};

// Mapeo de badges con descripciones cortas (si decides mantener alguno en el futuro)
const badges: Record<string, string> = {
	HOUSE_BALANCE: "<:BALANCE:933591740626133102>",
	EARLY_VERIFIED_BOT_DEVELOPER: "<:BOT_DEV:933589256784478209>",
	HOUSE_BRAVERY: "<:BRAVERY:933591329789857822>",
	HOUSE_BRILLIANCE: "<:BRILLIANCE:933591191252004894>",
	BUGHUNTER_LEVEL_1: "<:BUG_HUNTER_1:933592387295518750>",
	BUGHUNTER_LEVEL_2: "<:BUG_HUNTER_2:933592469650702366>",
	DISCORD_CERTIFIED_MODERATOR: "<:CERTIFIED_MODERATOR:933593447259054130>",
	DISCORD_EMPLOYEE: "<:DISCORD_EMPLOYEE:933594547538255883>",
	EARLY_SUPPORTER: "<:EARLY_SUPPORTER:933588811303256094>",
	HYPESQUAD_EVENTS: "<:HYPESQUAD_EVENTS:933595145704714260>",
	PARTNERED_SERVER_OWNER: "<:PARTNER:933594339047768094>",
	VERIFIED_BOT: "<:VERIFIED_BOT:933592598600384552>",
};

export default {
	data: new SlashCommandBuilder()
		.setName("user")
		.setDescription("Muestra información de un usuario de Discord.")
		.addUserOption((option) =>
			option.setName("usuario").setDescription("El usuario del cual quieres obtener información.").setRequired(false)
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			let targetUser: User = interaction.options.getUser("usuario") ?? interaction.user;
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
					.setColor(0x00ff00)
					.setTimestamp();

				// Enviar el embed como respuesta
				await replyOk(interaction, [embed]);
			} catch (error) {
				console.error("Error al obtener información del usuario:", error);
				return await replyError(interaction, "Hubo un error al obtener la información del usuario.");
			}
		}
	),
};
