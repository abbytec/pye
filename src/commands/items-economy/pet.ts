// src/commands/Currency/pet.ts
import { AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder, TextChannel } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyError } from "../../utils/messages/replyError.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { IPetDocument, Pets } from "../../Models/Pets.js";
import { Home, IHomeDocument } from "../../Models/Home.js";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default {
	group: "📚 - Inventario (Casino)",
	data: new SlashCommandBuilder()
		.setName("pet")
		.setDescription("Muestra a tu mascota en la economía o realiza acciones.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("show")
				.setDescription("Muestra tu mascota o la de otro usuario.")
				.addUserOption((option) => option.setName("usuario").setDescription("Usuario cuyo mascota deseas ver.").setRequired(false))
		)
		.addSubcommand((subcommand) => subcommand.setName("name").setDescription("Cambia el nombre de tu mascota."))
		.addSubcommand((subcommand) => subcommand.setName("play").setDescription("Juega con tu mascota."))
		.addSubcommand((subcommand) => subcommand.setName("feed").setDescription("Alimenta a tu mascota."))
		.addSubcommand((subcommand) => subcommand.setName("clean").setDescription("Limpia a tu mascota.")),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")), // Define el canal apropiado o elimina esta línea si no es necesaria
			deferInteraction(),
		],
		async (interaction: IPrefixChatInputCommand): Promise<void> => {
			const subcommand = interaction.options.getSubcommand();

			const userId = (await interaction.options.getUser("usuario"))?.id ?? interaction.user.id;

			// Obtener el miembro
			let member: GuildMember | null | undefined;
			if (userId) {
				member = await interaction.guild?.members.fetch(userId).catch(() => null);
				if (!member) return await replyError(interaction, "No se pudo encontrar al usuario especificado en este servidor.");
			} else member = interaction.member as GuildMember;

			if (member.user.bot) return await replyError(interaction, "Los bots no pueden tener un perfil.");

			const homeData = await Home.findOne({ id: member.id });
			if (!homeData) {
				const mensaje =
					member.id === interaction.user.id ? "Aún no tienes un perfil de economía." : "Aún no tiene un perfil de economía.";
				return await replyError(interaction, mensaje);
			}

			if (homeData.pet === "none") {
				const mensaje =
					member.id === interaction.user.id
						? "Aún no tienes una mascota.\nPuedes obtener una completando las quests."
						: "Aún no tiene una mascota.\nPuede obtener una completando las quests.";
				return await replyError(interaction, mensaje);
			}
			let petData =
				(await Pets.findOne({ id: member.id })) ??
				(await Pets.create({ id: member.id, name: "Sin nombre", mood: 100, food: 100, shower: 100 }));

			switch (subcommand) {
				case "show":
					await showPet(interaction, member, homeData, petData);
					break;
				case "name":
					await setPetName(interaction, member, petData);
					break;
				case "play":
					await playPet(interaction, petData);
					break;
				case "feed":
					await feedPet(interaction, petData);
					break;
				case "clean":
					await cleanPet(interaction, petData);
					break;
				default:
					await replyError(interaction, "Opción no válida.");
			}
		}
	),
} as Command;

async function showPet(interaction: IPrefixChatInputCommand, member: GuildMember, homeData: IHomeDocument, petInfo: IPetDocument) {
	const mood = getMood(petInfo);
	const rutaImagen = path.join(__dirname, `../../assets/Pictures/Profiles/Pets/${homeData.pet}${mood}.png`);

	// Crear el canvas y dibujar la imagen
	const canvas = createCanvas(550, 550);
	const ctx = canvas.getContext("2d");
	try {
		const img = await loadImage(rutaImagen);
		ctx.drawImage(img, 0, 0, 550, 550);
	} catch (error) {
		console.error("Error cargando la imagen de la mascota:", error);
		return await replyError(interaction, "Ocurrió un error al cargar la imagen de tu mascota.");
	}

	const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "pet.png" });

	// Crear el embed
	const embed = new EmbedBuilder()
		.setAuthor({
			name: `Mascota de ${member.user.username}`,
			iconURL: member.user.displayAvatarURL(),
		})
		.setThumbnail("attachment://pet.png")
		.addFields([
			{ name: "Nombre", value: petInfo.name !== "none" ? petInfo.name : "Sin nombre" },
			{ name: "Cariño", value: getBars(petInfo.mood), inline: true },
			{ name: "Hambre", value: getBars(petInfo.food), inline: true },
			{ name: "Higiene", value: getBars(petInfo.shower), inline: true },
		])
		.setTimestamp()
		.setColor(COLORS.okGreen);

	await replyOk(interaction, [embed], undefined, undefined, [attachment]);
}

function getMood(petInfo: IPetDocument): string {
	if (petInfo.mood <= 40 && petInfo.food <= 40 && petInfo.shower <= 40) return "Angry";

	return "Happy";
}

function getBars(value: number): string {
	if (value >= 100) return "■■■■■";
	if (value >= 80) return "■■■■□";
	if (value >= 60) return "■■■□□";
	if (value >= 40) return "■■□□□";
	if (value >= 20) return "■□□□□";
	return "□□□□□";
}

export async function setPetName(interaction: IPrefixChatInputCommand, member: GuildMember, petInfo: IPetDocument) {
	await interaction.reply({ content: "🦴- Escribe el nuevo nombre de tu mascota.", ephemeral: true });

	try {
		const filter = (m: any) => m.author.id === member.id && m.content.length <= 60;
		if (!interaction.channel?.isTextBased()) {
			return await replyError(interaction, "No se pudo acceder al canal de texto.");
		}
		// Asegurarse de que el canal sea TextChannel
		const textChannel = interaction.channel as TextChannel;

		const collected = await textChannel
			.awaitMessages({
				filter,
				max: 1,
				time: 120000,
				errors: ["time"],
			})
			.catch(() => null);

		if (!collected || collected.size === 0) {
			return await interaction.followUp({ content: "No has escrito nada, vuelve a intentarlo.", ephemeral: true });
		}

		const newName = collected.first()?.content.trim();
		petInfo.name = newName ?? "pipu";
		await petInfo.save();

		await replyOk(interaction, "El nombre de tu mascota ha sido cambiado.", undefined, undefined, undefined, undefined, true);
	} catch (error) {
		console.error("Error al cambiar el nombre de la mascota:", error);
		return await replyError(interaction, "Ocurrió un error al cambiar el nombre de tu mascota.");
	}
}

export async function playPet(interaction: IPrefixChatInputCommand, petInfo: IPetDocument) {
	// Lógica para jugar con la mascota
	petInfo.mood = Math.min(petInfo.mood + 10, 100); // Aumentar el cariño
	petInfo.food = Math.max(petInfo.food - 5, 0); // Disminuir el hambre
	petInfo.shower = Math.max(petInfo.shower - 5, 0); // Disminuir la higiene
	await petInfo.save();

	return await replyOk(interaction, "🐾 - Has jugado con tu mascota. ¡Está más feliz!");
}

export async function feedPet(interaction: IPrefixChatInputCommand, petInfo: IPetDocument) {
	// Lógica para alimentar a la mascota
	petInfo.food = Math.min(petInfo.food + 10, 100); // Aumentar el hambre
	await petInfo.save();

	return await replyOk(interaction, "🍽️ - Has alimentado a tu mascota. ¡Está más llena!");
}

export async function cleanPet(interaction: IPrefixChatInputCommand, petInfo: IPetDocument) {
	// Lógica para limpiar a la mascota
	petInfo.shower = Math.min(petInfo.shower + 10, 100); // Aumentar la higiene
	await petInfo.save();

	return await replyOk(interaction, "🧼 - Has limpiado a tu mascota. ¡Está más limpia!");
}
