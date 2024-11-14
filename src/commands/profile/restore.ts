// src/commands/Currency/restore.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember, Guild } from "discord.js";
import { Users } from "../../Models/User.ts";
import { Shop } from "../../Models/Shop.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { getChannelFromEnv } from "../../utils/constants.ts";

export default {
	data: new SlashCommandBuilder()
		.setName("restore")
		.setDescription("Quítate los roles de los ítems que hayas usado.")
		.addStringOption((option) => option.setName("ítem").setDescription("Nombre o ID del ítem a restaurar.").setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const user = interaction.user;
			const guild = interaction.guild as Guild;

			const member = guild.members.cache.get(user.id) as GuildMember;
			if (!member) return await replyError(interaction, "No se pudo obtener la información de tu usuario.");

			let itemInput = interaction.options.getString("ítem", true).trim();

			if (itemInput.startsWith("0")) itemInput = itemInput.replace(/^0+/, "");

			const item = await Shop.findOne({
				$or: [{ itemId: itemInput }, { name: { $regex: new RegExp(`^${itemInput}$`, "i") } }],
			}).exec();

			if (!item) return await replyError(interaction, "No existe un ítem con ese nombre.\nUso: `/restore <ítem>`.");

			const userData = await Users.findOne({ id: user.id }).exec();
			if (!userData) return await replyError(interaction, "No se pudo encontrar tu perfil de usuario.");

			if (!userData.inventory.includes(item._id)) return await replyError(interaction, "No tienes este ítem en tu inventario.");

			if (!item.role) return await replyError(interaction, "Este ítem no se puede des-usar.");

			if (!member.roles.cache.has(item.role)) return await replyError(interaction, "No has usado este ítem aún.");

			try {
				await member.roles.remove(item.role);
			} catch (error) {
				console.error(`Error removiendo el rol ${item.role} al usuario ${user.id}:`, error);
				return await replyError(interaction, "Hubo un error al intentar remover el ítem. Inténtalo de nuevo más tarde.");
			}

			return await replyOk(interaction, `¡Has desusado el ítem **${item.name}**!`);
		}
	),
};
