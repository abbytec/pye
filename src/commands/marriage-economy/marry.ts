// src/commands/marriage-economy/marry.ts
import { SlashCommandBuilder, EmbedBuilder, GuildMember, AttachmentBuilder, Guild } from "discord.js";
import { getOrCreateUser } from "../../Models/User.js";
import { Shop } from "../../Models/Shop.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "💍 - Matrimonios (Casino)",
	data: new SlashCommandBuilder()
		.setName("marry")
		.setDescription("Pídele matrimonio al amor de tu vida.")
		.addUserOption((option) => option.setName("usuario").setDescription("La persona con la que quieres casarte.").setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casino")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;
			const guild = interaction.guild as Guild;

			const member = guild.members.cache.get(user.id);
			if (!member) return await replyError(interaction, "No se pudo obtener la información de tu usuario en este servidor.");

			// Obtener el usuario objetivo
			const targetUser = await interaction.options.getUser("usuario", true);
			if (!targetUser) return await replyWarning(interaction, "No se pudo encontrar al usuario especificado.");
			if ((targetUser.createdAt.getTime() ?? 0) > new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).getTime())
				return await replyError(interaction, "No puedes casarte con una cuenta recientemente creada.");
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
			const userData = await getOrCreateUser(user.id);

			// Verificar si el usuario tiene el anillo en su inventario
			if (!userData.inventory.includes(ringItem._id))
				return await replyError(interaction, "Necesitas comprar un anillo para poder casarte.");

			// Obtener los datos del usuario objetivo
			const targetData = await getOrCreateUser(targetUser.id);

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
						value: `Usa: \`/marriage accept @${user.username}\``,
						inline: true,
					},
					{
						name: "Rechazar propuesta",
						value: `Usa: \`/marriage decline @${user.username}\``,
						inline: true,
					},
				])
				.setColor(COLORS.pyeCutePink)
				.setTimestamp();

			// Enviar la propuesta en el canal
			await replyOk(interaction, [embed], undefined, undefined, undefined, `<@${targetUser.id}>`, false);
		}
	),
} as Command;
