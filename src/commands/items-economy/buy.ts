// src/commands/Currency/buy.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember } from "discord.js";
import { getOrCreateUser, Users } from "../../Models/User.js";
import { Shop } from "../../Models/Shop.js";
import { UserRole } from "../../Models/Role.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { ExtendedClient } from "../../client.js";

export default {
	group: "📚 - Inventario (Casino)",
	data: new SlashCommandBuilder()
		.setName("buy")
		.setDescription("Compra un ítem de la tienda.")
		.addStringOption((option) => option.setName("item").setDescription("Nombre o ID del ítem que deseas comprar.").setRequired(true))
		.addIntegerOption((option) => option.setName("cantidad").setDescription("Cantidad de ítems que deseas comprar.").setRequired(false)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener opciones del comando
			let itemInput = interaction.options.getString("item", true);
			let amount = interaction.options.getInteger("cantidad") ?? 1;

			// Limpiar el input del ítem (eliminar ceros a la izquierda)
			if (itemInput.startsWith("0")) {
				itemInput = itemInput.replace(/^0+/, "");
			}

			// Validar la cantidad
			if (isNaN(amount) || amount <= 0) {
				amount = 1;
			}

			try {
				let userData = await getOrCreateUser(user.id);

				// Buscar el ítem en la tienda por ID o nombre (case-insensitive)
				const itemData =
					(await Shop.findOne({ itemId: itemInput })) ??
					(await Shop.findOne({
						name: { $regex: new RegExp(`^${itemInput}$`, "i") },
					}));

				if (!itemData) return await replyError(interaction, "No existe un ítem con ese nombre o ID.\nUso: `/buy [Nombre de ítem]`");

				// Verificar si el ítem es 'restart' y el usuario no tiene perfil
				if (/^restart$/i.test(itemData.name) && !userData.profile) return await replyError(interaction, "No puedes comprar este ítem.");

				// Verificar si el ítem no es almacenable y ya está en el inventario
				if (!itemData.storable && userData.inventory.some((invItemId) => invItemId.toString() === itemData._id.toString())) {
					return await replyError(interaction, "Ya posees ese ítem en tu inventario.");
				}

				// Calcular el costo total
				const totalCost = ExtendedClient.getInflatedRate(itemData.price * amount);

				// Verificar si el usuario tiene suficiente dinero
				if (totalCost > (userData.cash ?? 0))
					return await replyError(interaction, "No tienes suficientes **PyE Coins** para comprar este ítem.");

				// Manejar ítems que otorgan roles temporales
				if (itemData.role && itemData.timeout > 0) await handleTempRole(interaction, userData, itemData, amount);

				// Deduct cash
				userData.cash -= totalCost;

				// Añadir el ítem al inventario
				for (let i = 0; i < amount; i++) userData.inventory.push(itemData._id);

				// Guardar los cambios del usuario
				await Users.updateOne({ id: user.id }, { $inc: { cash: -totalCost } });

				const icon = itemData.icon ? itemData.icon + " " : "";

				// Crear la respuesta de éxito
				const successMessage =
					amount <= 1
						? `Has comprado el ítem ${icon}**${itemData.name}**.`
						: `Has comprado el ítem ${icon}**${itemData.name}** (x${amount}).`;

				return await replyOk(interaction, successMessage);
			} catch (error) {
				console.error("Error en el comando /buy:", error);
				return await replyError(interaction, "Ocurrió un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}
		}
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(client, "buy", [
			{
				name: "item",
				required: true,
			},
			{
				name: "cantidad",
				required: false,
			},
		]),
} as Command;

// Función para manejar roles temporales
async function handleTempRole(
	interaction: IPrefixChatInputCommand,
	userData: any, // Reemplaza con la interfaz adecuada si está definida
	itemData: any, // Reemplaza con la interfaz adecuada si está definida
	amount: number
) {
	const member = interaction.member;

	if (!member || !(member instanceof GuildMember)) {
		return await replyError(interaction, "No se pudo acceder a tu información de miembro.");
	}

	// Verificar si el usuario ya tiene el rol
	if (member.roles.cache.has(itemData.role)) {
		return await replyError(interaction, "Ya posees este rol en tu perfil.");
	}

	// Calcular el costo total
	const totalCost = itemData.price * amount;

	// Verificar si el usuario tiene suficiente dinero
	if (totalCost > (userData.cash ?? 0)) {
		return await replyError(interaction, "No tienes suficientes **PyE Coins** para comprar este ítem.");
	}

	// Deduct cash
	userData.cash -= totalCost;

	// Guardar los cambios del usuario
	await userData.save();

	// Asignar el rol al usuario
	try {
		await member.roles.add(itemData.role);
	} catch (error) {
		console.error("Error asignando el rol:", error);
		return await replyError(interaction, "Ocurrió un error al asignarte el rol. Inténtalo de nuevo más tarde.");
	}

	// Crear un registro en UserRole
	try {
		await UserRole.create({
			id: userData.id,
			rolId: itemData.role,
			guildId: interaction.guildId,
			count: itemData.timeout * 1000 + Date.now(), // Asumiendo que 'timeout' está en segundos
		});
	} catch (error) {
		console.error("Error creando el registro de UserRole:", error);
		// Puedes optar por eliminar el rol si falla la creación del registro
		try {
			await member.roles.remove(itemData.role);
		} catch (removeError) {
			console.error("Error removiendo el rol tras fallo en UserRole:", removeError);
		}
		return await replyError(interaction, "Ocurrió un error al procesar tu rol temporal. Inténtalo de nuevo más tarde.");
	}

	// Enviar mensaje personalizado si existe
	if (itemData.message) {
		try {
			await interaction.followUp({ content: itemData.message, ephemeral: true });
		} catch (error) {
			console.error("Error enviando mensaje personalizado:", error);
			// No es crítico, continuar
		}
	} else {
		// Respuesta de éxito
		return await replyOk(interaction, `Has comprado el ítem \`${itemData.name}\` con éxito.`);
	}
}
