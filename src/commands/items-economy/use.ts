// src/commands/Currency/use.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember } from "discord.js";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.js";
import { IShopDocument, Shop } from "../../Models/Shop.js";
import { UserRole } from "../../Models/Role.js";
import { Home } from "../../Models/Home.js";
import { Pets } from "../../Models/Pets.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";

export default {
	group: "📚 - Inventario (Casino)",
	data: new SlashCommandBuilder()
		.setName("use")
		.setDescription("Utiliza los ítems que tengas en tu inventario.")
		.addStringOption((option) => option.setName("item").setDescription("Nombre o ID del ítem que deseas utilizar.").setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;
			const member = interaction.member as GuildMember;

			let itemInput = interaction.options.getString("item", true);
			if (itemInput.startsWith("0")) itemInput = itemInput.replace(/^0+/, "");

			let userData: IUserModel = await getOrCreateUser(user.id);

			// Buscar el ítem por ID o nombre (incluyendo la propiedad "background" si existe)
			const itemData =
				(await Shop.findOne({ itemId: itemInput })) ??
				(await Shop.findOne({
					name: { $regex: new RegExp(`^${itemInput}$`, "i") },
				}));
			if (!itemData) return await replyError(interaction, "No existe un ítem con ese nombre o ID.\nUso: `/use [Nombre de ítem]`");

			const excludedItems = [
				{
					name: /^chicken$/i,
					message: "No puedes usar el pollo con este comando.\nPuedes usarlo utilizando el comando `chicken-fight`.",
				},
				{
					name: /^anillo$/i,
					message: "No puedes usar el anillo con este comando.\nPuedes usarlo utilizando el comando `/marry` o `/acceptmarriage`.",
				},
				{
					name: /^shampoo$/i,
					message: "No puedes usar el shampoo con este comando.\nPuedes usarlo utilizando el comando `/pet clean`.",
				},
				{ name: /^pelota$/i, message: "No puedes usar la pelota con este comando.\nPuedes usarlo utilizando el comando `/pet play`." },
				{
					name: /^alimento$/i,
					message: "No puedes usar el alimento con este comando.\nPuedes usarlo utilizando el comando `/pet feed`.",
				},
			];

			for (const excluded of excludedItems) {
				if (excluded.name.test(itemData.name)) return await replyError(interaction, `${excluded.message}`);
			}

			if (/^restart$/i.test(itemData.name)) {
				return await handleReset(interaction, userData, itemData);
			}

			// Verificar que el usuario posea el ítem en su inventario
			if (!userData.inventory.includes(itemData._id)) return await replyError(interaction, "No tienes este ítem en tu inventario.");

			// Si el ítem posee la propiedad "background", se establece como fondo del perfil
			if (itemData.background) {
				userData.customBackground = itemData.background;
				await userData.save();
				return await replyOk(interaction, `¡Has establecido el fondo ${itemData.name} en tu perfil!`);
			}

			// Resto de la lógica (roles, grupos, etc.)
			if (itemData.group) {
				const groupItem = await Shop.findOne({
					role: { $in: [...member.roles.cache.keys()] },
					_id: { $in: userData.inventory },
					group: itemData.group,
				}).lean();
				if (groupItem)
					return await replyError(
						interaction,
						`Ya tienes un ítem de \`${groupItem.group}\` en uso.\nPuedes quitarte el actual utilizando el comando \`restore\`.`
					);
			}

			if (itemData.role && itemData.timeout && itemData.timeout > 0) return await handleTempRole(interaction, userData, itemData);

			if (!itemData.role) {
				const itemIndex = userData.inventory.indexOf(itemData._id);
				if (itemIndex > -1) {
					userData.inventory.splice(itemIndex, 1);
					await userData.save();
				}
				return await replyOk(interaction, `¡Has utilizado el ítem ${itemData.name}!`);
			}

			if (itemData.role && !member.roles.cache.has(itemData.role)) {
				try {
					await member.roles.add(itemData.role);
				} catch (error) {
					console.error("Error asignando el rol:", error);
					return await replyError(interaction, "Ocurrió un error al asignarte el rol. Inténtalo de nuevo más tarde.");
				}

				if (!itemData.storable) {
					const itemIndex = userData.inventory.indexOf(itemData._id);
					if (itemIndex > -1) {
						userData.inventory.splice(itemIndex, 1);
						await userData.save();
					}
				}

				if (itemData.message) return await replyOk(interaction, itemData.message);
				else return await replyOk(interaction, `¡Has utilizado el ítem ${itemData.name}!`);
			}

			if (itemData.role && member.roles.cache.has(itemData.role)) {
				const itemIndex = userData.inventory.indexOf(itemData._id);
				if (itemIndex > -1) {
					userData.inventory.splice(itemIndex, 1);
					await userData.save();
				}
				return await replyError(interaction, "Ya tienes este rol en tu perfil.");
			}

			return await replyOk(interaction, `¡Has utilizado el ítem ${itemData.name}!`);
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(client, "use", [
			{
				name: "item",
				required: true,
			},
		]),
} as Command;

async function handleTempRole(interaction: IPrefixChatInputCommand, userData: IUserModel, itemData: IShopDocument) {
	const member = interaction.member as GuildMember;

	if (member.roles.cache.has(itemData.role)) return await replyError(interaction, "Ya posees este rol en tu perfil.");

	const itemIndex = userData.inventory.indexOf(itemData._id);
	if (itemIndex > -1) {
		userData.inventory.splice(itemIndex, 1);
		await userData.save();
	}

	try {
		await member.roles.add(itemData.role);
	} catch (error) {
		console.error("Error asignando el rol temporal:", error);
		return await replyError(interaction, "Ocurrió un error al asignarte el rol temporal. Inténtalo de nuevo más tarde.");
	}

	try {
		await UserRole.create({
			id: userData.id,
			rolId: itemData.role,
			guildId: interaction.guildId!,
			count: itemData.timeout + Date.now(),
		});
	} catch (error) {
		console.error("Error creando el registro de UserRole:", error);
		try {
			await member.roles.remove(itemData.role);
		} catch (removeError) {
			console.error("Error removiendo el rol tras fallo en UserRole:", removeError);
		}
		return await replyError(interaction, "Ocurrió un error al procesar tu rol temporal. Inténtalo de nuevo más tarde.");
	}

	if (itemData.message) return await replyOk(interaction, itemData.message);
	else return await replyOk(interaction, `¡Has utilizado el ítem ${itemData.name} y se te ha asignado el rol temporal!`);
}

async function handleReset(interaction: IPrefixChatInputCommand, userData: IUserModel, itemData: IShopDocument) {
	const itemIndex = userData.inventory.indexOf(itemData._id);
	if (itemIndex > -1) userData.inventory.splice(itemIndex, 1);

	userData.profile = undefined;
	await userData.save();

	try {
		await Home.deleteOne({ id: userData.id });
		await Pets.deleteOne({ id: userData.id });
	} catch (error) {
		console.error("Error eliminando Home o Pets:", error);
		return await replyError(interaction, "Ocurrió un error al resetear tu perfil. Inténtalo de nuevo más tarde.");
	}

	return await replyOk(interaction, "Se ha eliminado tu perfil correctamente.");
}
