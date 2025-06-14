// src/commands/Currency/marriage.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember, User, CommandInteraction, Guild } from "discord.js";
import { IUserModel, getOrCreateUser } from "../../Models/User.js";
import { Shop } from "../../Models/Shop.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

// Lista de GIFs para la confirmación de matrimonio
const gifs: string[] = [
	"https://tenor.com/view/marriage-marry-up-kiss-gif-4360989",
	"https://tenor.com/view/goku-chichi-wedding-dragon-ball-married-gif-18174144",
	"https://tenor.com/view/anime-ring-married-marriage-marry-me-gif-12390162",
	"https://tenor.com/view/muppet-show-muppets-kermit-miss-piggy-married-gif-25739714",
];

export default {
	group: "💍 - Matrimonios (Casino)",
	data: new SlashCommandBuilder()
		.setName("marriage")
		.setDescription("Gestiona las propuestas de matrimonio.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("accept")
				.setDescription("Acepta una propuesta de matrimonio.")
				.addUserOption((option) =>
					option.setName("usuario").setDescription("La persona que te ha propuesto matrimonio.").setRequired(true)
				)
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName("decline")
				.setDescription("Rechaza una propuesta de matrimonio.")
				.addUserOption((option) =>
					option.setName("usuario").setDescription("La persona cuya propuesta deseas rechazar.").setRequired(true)
				)
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const subcommand = interaction.options.getSubcommand();
			const targetUser = await interaction.options.getUser("usuario", true);
			if (!targetUser) return;
			const guild = interaction.guild as Guild;

			const member: GuildMember | undefined = guild.members.cache.get(targetUser.id);
			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario especificado en este servidor.");

			// Obtener los datos del usuario que ejecuta el comando
			let userData: IUserModel = await getOrCreateUser(interaction.user.id);

			// Obtener los datos del usuario objetivo
			let targetData: IUserModel = await getOrCreateUser(targetUser.id);

			switch (subcommand) {
				case "accept":
					return handleAcceptMarriage(interaction, userData, targetData, targetUser, member, guild);
				case "refuse":
					return handleRefuseMarriage(interaction, userData, targetData, targetUser, member, guild);
				default:
					return await replyError(interaction, "Subcomando no reconocido.");
			}
		}
	),
} as Command;

/**
 * Maneja la aceptación de una propuesta de matrimonio.
 */
async function handleAcceptMarriage(
	interaction: IPrefixChatInputCommand,
	userData: IUserModel,
	targetData: IUserModel,
	targetUser: User,
	targetMember: GuildMember,
	guild: any
) {
	// Verificar si hay una propuesta pendiente de targetUser hacia el usuario que ejecuta el comando
	if (!userData.proposals.includes(targetUser.id)) {
		return await replyError(interaction, "No tienes una propuesta de esa persona.");
	}

	// Buscar el ítem "anillo" en la tienda
	const ringItem = await Shop.findOne({
		name: { $regex: /anillo/gi },
	}).lean();
	if (!ringItem)
		return await replyError(
			interaction,
			"Parece que aún no hay anillos en la tienda.\nUn administrador debe usar el comando `/items` y agregarlo a la tienda."
		);

	// Verificar que el usuario tenga el anillo en su inventario
	if (!userData.inventory.includes(ringItem._id)) return await replyError(interaction, "Necesitas comprar un anillo para poder casarte.");

	// Verificar que el usuario objetivo no haya alcanzado el límite de matrimonios
	if (targetData.couples.length >= 10) return await replyError(interaction, "Esta persona ya llegó al límite de matrimonios.");

	// Verificar que el usuario que ejecuta el comando no haya alcanzado el límite de matrimonios
	if (userData.couples.length >= 10) return await replyError(interaction, "Ya has alcanzado el límite de matrimonios.");

	// Verificar que ya no estén casados
	const alreadyMarried = userData.couples.some((couple) => couple.user === targetUser.id);
	if (alreadyMarried) {
		return await replyError(interaction, "Ya te encuentras casado con esa persona ♥.");
	}

	// Remover la propuesta de la lista de propuestas del usuario
	userData.proposals = userData.proposals.filter((id: string) => id !== targetUser.id);

	// Remover el anillo del inventario del usuario
	userData.inventory = userData.inventory.filter((itemId) => itemId !== ringItem._id);

	// Agregar a cada uno en la lista de parejas del otro
	userData.couples.push({ user: targetUser.id, job: targetData.profile?.job ?? "Sin trabajo" });
	targetData.couples.push({ user: interaction.user.id, job: userData.profile?.job ?? "Sin trabajo" });

	// Guardar los cambios en la base de datos
	await Promise.all([userData.save(), targetData.save()]);

	// Seleccionar un GIF aleatorio
	const randomGif = gifs[Math.floor(Math.random() * gifs.length)];

	// Crear el embed de confirmación
	const embed = new EmbedBuilder()
		.setTitle("Felicidades, tienen boda 🎉!")
		.setDescription(`¡ \`${interaction.user.username}\` y \`${targetUser.username}\` ahora están casados 🎉!\nVivan los novios 💕`)
		.setImage(randomGif)
		.setColor(COLORS.pyeCutePink)
		.setTimestamp();

	return await replyOk(interaction, [embed]);
}

/**
 * Maneja el rechazo de una propuesta de matrimonio.
 */
async function handleRefuseMarriage(
	interaction: IPrefixChatInputCommand,
	userData: IUserModel,
	targetData: IUserModel,
	targetUser: User,
	targetMember: GuildMember,
	guild: any
) {
	// Verificar si hay una propuesta pendiente de targetUser hacia el usuario que ejecuta el comando
	if (!userData.proposals.includes(targetUser.id)) {
		return await replyError(interaction, "No tienes una propuesta de esa persona.");
	}

	// Remover la propuesta de la lista de propuestas del usuario
	userData.proposals = userData.proposals.filter((id: string) => id !== targetUser.id);

	// Guardar los cambios en la base de datos
	await userData.save();

	// Crear el embed de rechazo
	const embed = new EmbedBuilder()
		.setTitle("Que mal..")
		.setDescription(`¡ \`${interaction.user.username}\` ha rechazado la propuesta de \`${targetUser.username}\`.\n¡Sigue adelante! ❤️`)
		.setColor(COLORS.errRed) // Rojo para indicar rechazo
		.setTimestamp();

	return await replyOk(interaction, [embed]);
}
