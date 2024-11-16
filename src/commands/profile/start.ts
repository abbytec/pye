// start.ts

import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	AttachmentBuilder,
	StringSelectMenuBuilder,
} from "discord.js";
import { Users } from "../../Models/User.ts";
import { Home } from "../../Models/Home.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs";
import { replyWarning } from "../../utils/messages/replyWarning.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { getChannelFromEnv } from "../../utils/constants.ts";
import { replyError } from "../../utils/messages/replyError.ts";

// Enumeraciones para género, tono de piel y profesiones
enum Gender {
	Mujer = "Mujer",
	Hombre = "Hombre",
}

enum SkinTone {
	Blanco = "Blanco",
	Intermedio = "Intermedio",
	Moreno = "Moreno",
}

enum Job {
	Policia = "Policia",
	Ladron = "Ladron",
	Militar = "Militar",
	Bombero = "Bombero",
	Doctor = "Doctor",
	Enfermero = "Enfermero",
	Obrero = "Obrero",
}

// Conjunto para evitar procesos simultáneos
const onIt = new Set<string>();

export default {
	group: "👤 - Perfiles (Casino)",
	data: new SlashCommandBuilder().setName("start").setDescription("Comienza a crear tu perfil en la economía."),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye"))],
		async (interaction: ChatInputCommandInteraction): Promise<void> => {
			const userId = interaction.user.id;

			// Verificar si el usuario ya tiene un perfil
			const userData = await Users.findOne({ id: userId });
			if (userData?.profile) return await replyWarning(interaction, "Ya tienes un perfil.");

			// Verificar si el usuario está en proceso de creación
			if (onIt.has(userId)) return await replyWarning(interaction, "Ya estás en un proceso de creación.");

			onIt.add(userId);

			// Enviar mensaje inicial
			const initialEmbed = new EmbedBuilder()
				.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
				.setThumbnail(interaction.guild?.iconURL() ?? null)
				.setDescription(
					`Hola \`${interaction.user.tag}\` 👋, bienvenido al menú para crear tu perfil en el sistema de economía de **Programadores y Estudiantes**. La creación de tu perfil comenzará en 10 segundos...`
				)
				.setTimestamp();

			const message = await interaction.reply({
				content: `<@${userId}>`,
				embeds: [initialEmbed],
				ephemeral: true,
			});

			// Esperar 10 segundos antes de comenzar
			setTimeout(async () => await startProfile(message, interaction), 10_000);
		},
		[]
	),
};

// Función principal para manejar el proceso de creación del perfil
async function startProfile(message: any, interaction: ChatInputCommandInteraction) {
	const userId = interaction.user.id;

	try {
		// Paso 1: Selección de género
		const gender = await selectOption(
			message,
			interaction,
			"Empecemos por tu género...",
			"Selecciona tu género.",
			[
				{ label: "Mujer", value: Gender.Mujer, emoji: "🤷‍♀️" },
				{ label: "Hombre", value: Gender.Hombre, emoji: "🤷‍♂️" },
			],
			"sex"
		);

		if (!gender) throw new Error("Timeout");

		// Paso 2: Selección de tono de piel
		const skin = await selectOption(
			message,
			interaction,
			"Ahora escoge el tono de piel de tu personaje...",
			"Selecciona el tono de piel de tu personaje.",
			[
				{ label: "Blanco", value: SkinTone.Blanco, emoji: "👋🏻" },
				{ label: "Intermedio", value: SkinTone.Intermedio, emoji: "👋🏽" },
				{ label: "Moreno", value: SkinTone.Moreno, emoji: "👋🏾" },
			],
			"skin"
		);

		if (!skin) throw new Error("Timeout");

		// Paso 3: Selección de profesión
		const job = await selectOption(
			message,
			interaction,
			"Ahora escoge una profesión!",
			"Selecciona una profesión.",
			getJobOptions(gender),
			"job"
		);

		if (!job) throw new Error("Timeout");

		// Paso 4: Selección de estilo
		const style = await selectStyle(message, interaction, gender, skin, job);

		if (!style) throw new Error("Timeout");

		// Crear el perfil en la base de datos
		await Users.updateOne(
			{ id: userId },
			{
				$set: {
					profile: { gender, skin, job, style },
				},
			},
			{ upsert: true }
		);

		// Crear una casa para el usuario
		await Home.create({ id: userId });

		replyOk(
			interaction,
			`Has creado tu perfil correctamente.\nPuedes mirarlo usando \`/profile\`.\nTambién puedes mirar tu casa con \`/home\` y completar tareas para subirla de nivel con \`/quest\`.`,
			undefined,
			undefined,
			undefined,
			undefined,
			false
		);
	} catch (error) {
		console.error(error);
		await replyError(interaction, "Se acabo el tiempo...");
	} finally {
		onIt.delete(userId);
	}
}

// Función para manejar la selección de opciones (género, tono de piel, profesión)
async function selectOption(
	message: any,
	interaction: ChatInputCommandInteraction,
	description: string,
	placeholder: string,
	options: { label: string; value: string; emoji: string }[],
	customId: string
): Promise<string | null> {
	const embed = new EmbedBuilder()
		.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
		.setDescription(description)
		.addFields([{ name: "• Lista", value: options.map((opt, index) => `${index + 1}. ${opt.label} ${opt.emoji}`).join("\n") }])
		.setTimestamp()
		.setFooter({ text: "Tienes 2 minutos para responder." });

	const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
		new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder(placeholder).addOptions(options)
	);

	await message.edit({
		embeds: [embed],
		components: [row],
		ephemeral: true,
	});

	const response = await message
		.awaitMessageComponent({
			filter: (i: any) => i.user.id === interaction.user.id && i.customId === customId,
			time: 120_000,
		})
		.catch(() => null);

	if (!response) return null;

	await response.deferUpdate();

	return response.values[0];
}

// Función para obtener las opciones de profesiones según el género
function getJobOptions(gender: string) {
	return [
		{
			label: "Policía",
			value: Job.Policia,
			emoji: gender === Gender.Hombre ? "👮‍♂️" : "👮‍♀️",
		},
		{
			label: gender === Gender.Hombre ? "Ladrón" : "Ladrona",
			value: gender === Gender.Hombre ? Job.Ladron : "Ladrona",
			emoji: "🥷",
		},
		{
			label: "Militar",
			value: Job.Militar,
			emoji: "🪖",
		},
		{
			label: gender === Gender.Hombre ? Job.Bombero : "Bombera",
			value: gender === Gender.Hombre ? Job.Bombero : "Bombera",
			emoji: gender === Gender.Hombre ? "👨‍🚒" : "👩‍🚒",
		},
		{
			label: gender === Gender.Hombre ? Job.Doctor : "Doctora",
			value: gender === Gender.Hombre ? Job.Doctor : "Doctora",
			emoji: gender === Gender.Hombre ? "👨‍⚕️" : "👩‍⚕️",
		},
		{
			label: gender === Gender.Hombre ? Job.Enfermero : "Enfermera",
			value: gender === Gender.Hombre ? Job.Enfermero : "Enfermera",
			emoji: "😷",
		},
		{
			label: gender === Gender.Hombre ? Job.Obrero : "Obrera",
			value: gender === Gender.Hombre ? Job.Obrero : "Obrera",
			emoji: gender === Gender.Hombre ? "👷‍♂️" : "👷‍♀️",
		},
	];
}

// Función para manejar la selección de estilo
export async function selectStyle(
	message: any,
	interaction: ChatInputCommandInteraction,
	gender: string,
	skin: string,
	job: string
): Promise<string | null> {
	const stylesPath = path.resolve(process.cwd(), "src", "utils", "Pictures", "Profiles", gender, skin);

	if (!fs.existsSync(stylesPath)) return null;

	// Leer subdirectorios dentro de stylesPath
	const styleDirs = fs
		.readdirSync(stylesPath, { withFileTypes: true })
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	const rutas: string[] = styleDirs
		.map((dir) => {
			const dirPath = path.join(stylesPath, dir);
			const files = fs.readdirSync(dirPath);
			const file = files.find((fileName) => fileName.replace(".png", "").toLowerCase() === job.toLowerCase());
			if (file) return path.join(dirPath, file);
			else console.error(`No se encontró archivo para el job en ${dirPath}`);
		})
		.filter((filePath): filePath is string => filePath !== null);

	if (rutas.length === 0) {
		console.error(`No se encontraron archivos .png para el job: ${job}`);
		return null;
	}

	let page = 0;
	const totalStyles = rutas.length;

	const content = async (disable: boolean = false) => {
		const canvas = createCanvas(470, 708);
		const ctx = canvas.getContext("2d");
		try {
			const img = await loadImage(rutas[page]);
			ctx.drawImage(img, 0, 0, 470, 708);
		} catch (error) {
			console.error(`Error al cargar la imagen: ${rutas[page]}`, error);
			return null;
		}

		const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "estilo.png" });

		const embed = new EmbedBuilder()
			.setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
			.setDescription("Perfecto, ahora escoge el estilo que más te guste para tu personaje.")
			.addFields([{ name: "Estilo", value: `Este es el estilo #${page + 1}` }])
			.setImage("attachment://estilo.png")
			.setFooter({ text: "Tienes 2 minutos para responder, usa las flechas para cambiar de imagen." })
			.setTimestamp();

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder()
				.setStyle(ButtonStyle.Primary)
				.setLabel("«")
				.setCustomId("back")
				.setDisabled(page === 0),
			new ButtonBuilder()
				.setStyle(ButtonStyle.Primary)
				.setLabel("»")
				.setCustomId("next")
				.setDisabled(page === totalStyles - 1)
		);

		const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
			new StringSelectMenuBuilder()
				.setCustomId("styles")
				.setPlaceholder("Selecciona el estilo de tu personaje.")
				.addOptions(
					styleDirs.map((dir, i) => ({
						label: `Estilo ${i + 1}`,
						value: `${i + 1}`,
						emoji: "🎈",
					}))
				)
		);

		return {
			embeds: [embed],
			components: [row, selectRow],
			files: [attachment],
		};
	};

	const initialContent = await content();
	if (!initialContent) return null;
	await message.edit(initialContent);

	// Coleccionador para botones de navegación
	const collector = message.createMessageComponentCollector({
		filter: (i: any) => i.user.id === interaction.user.id && ["next", "back"].includes(i.customId),
		time: 60_000,
	});

	collector.on("collect", async (i: any) => {
		if (i.customId === "back" && page > 0) page--;
		else if (i.customId === "next" && page < totalStyles - 1) page++;
		else {
			await i.deferUpdate();
			return;
		}

		const newContent = await content();
		if (!newContent) return;

		await i.update(newContent);
	});

	const styleResponse = await message
		.awaitMessageComponent({
			filter: (i: any) => i.user.id === interaction.user.id && i.customId === "styles",
			time: 60_000,
		})
		.catch((err: any) => {
			console.error("Error al esperar la selección de estilo:", err);
			return null;
		});

	if (!styleResponse) return null;

	await styleResponse.deferUpdate();
	collector.stop();

	return styleResponse.values[0];
}
