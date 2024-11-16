// src/commands/Currency/marry.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember, User, AttachmentBuilder } from "discord.js";
import { getOrCreateUser } from "../../Models/User.ts";
import { Shop } from "../../Models/Shop.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { replyWarning } from "../../utils/messages/replyWarning.ts";
import { getChannelFromEnv } from "../../utils/constants.ts";

export default {
	group: "💍 - Matrimonios (Casino)",
	data: new SlashCommandBuilder()
		.setName("marry")
		.setDescription("Pídele matrimonio al amor de tu vida.")
		.addUserOption((option) => option.setName("usuario").setDescription("La persona con la que quieres casarte.").setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const user = interaction.user;
			const guild = interaction.guild;

			if (!guild) return await replyError(interaction, "Este comando solo puede usarse dentro de un servidor.");

			const member = guild.members.cache.get(user.id);
			if (!member) return await replyError(interaction, "No se pudo obtener la información de tu usuario en este servidor.");

			// Obtener el usuario objetivo
			const targetUser: User = interaction.options.getUser("usuario", true);
			const targetMember: GuildMember | undefined = guild.members.cache.get(targetUser.id);

			// Validaciones iniciales
			if (!targetMember) return await replyError(interaction, "No se pudo encontrar al usuario especificado en este servidor.");

			if (targetMember.id === user.id) {
				return replyWarning(interaction, "Imagina algo así... 😉", undefined, undefined, [
					new AttachmentBuilder("https://media.discordapp.net/attachments/910755738966716416/962179988625440859/descarga.jpg", {
						name: "descarga.jpg",
					}),
				]);
			}

			if (targetMember.user.bot) return await replyError(interaction, "Los bots no tenemos sentimientos 😔.");

			// Buscar el ítem "anillo" en la tienda
			const ringItem = await Shop.findOne({
				name: { $regex: /anillo/gi },
			}).lean();
			if (!ringItem)
				return await replyError(
					interaction,
					"Parece que aún no hay anillos en la tienda.\nUn administrador debe usar el comando `/items` y agregarlo a la tienda."
				);

			// Obtener los datos del usuario que envía la propuesta
			let userData = await getOrCreateUser(user.id);

			// Verificar si el usuario tiene el anillo en su inventario
			if (!userData.inventory.includes(ringItem._id))
				return await replyError(interaction, "Necesitas comprar un anillo para poder casarte.");

			// Obtener los datos del usuario objetivo
			let targetData = await getOrCreateUser(targetUser.id);

			// Verificar que el usuario objetivo tenga un perfil
			if (!targetData.profile) return await replyError(interaction, "Este usuario no tiene un perfil.");

			// Verificar el límite de matrimonios del usuario objetivo
			if (targetData.couples?.length >= 10) return await replyError(interaction, "Esta persona ya llegó al límite de matrimonios.");

			// Verificar si el usuario ya está casado con el objetivo
			if (userData.couples?.some((couple) => couple.user === targetUser.id))
				return await replyError(interaction, "Ya te encuentras casado con esa persona ♥.");

			// Verificar si ya existe una propuesta de matrimonio pendiente
			if (targetData.proposals.includes(user.id))
				return await replyError(interaction, "Ya tienes una propuesta de matrimonio pendiente con este usuario.");

			// Agregar la propuesta al usuario objetivo
			targetData.proposals.push(user.id);
			await targetData.save();

			// Crear el embed de la propuesta de matrimonio
			const embed = new EmbedBuilder()
				.setAuthor({
					name: `💍 Propuesta de matrimonio de ${user.tag}`,
					iconURL: user.displayAvatarURL(),
				})
				.setDescription(
					`\`${user.tag}\` te ha enviado una propuesta de matrimonio.\n**${targetUser}**, ¿Te gustaría aceptar su propuesta? 😳`
				)
				.addFields([
					{
						name: "Aceptar propuesta",
						value: `Usa: \`/acceptmarriage @${user.username}\``,
						inline: true,
					},
					{
						name: "Rechazar propuesta",
						value: `Usa: \`/declinemarriage @${user.username}\``,
						inline: true,
					},
				])
				.setColor(0xff69b4) // Color rosa para simbolizar el amor
				.setTimestamp();

			// Enviar la propuesta en el canal
			await replyOk(interaction, [embed], undefined, undefined, undefined, `<@${targetUser.id}>`, false);
		}
	),
};
