import { Canvas, createCanvas, Image, loadImage } from "@napi-rs/canvas";
import { GuildMember } from "discord.js";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Genera una imagen personalizada para un Booster utilizando @napi-rs/canvas.
 * La imagen contiene una imagen de fondo, el avatar del miembro dentro de un círculo centrado y su display name debajo.
 *
 * @param {GuildMember} member - El miembro de Discord para el cual se genera la imagen.
 * @returns {Promise<Buffer>} - Un buffer que representa la imagen generada en formato PNG.
 */
async function generateCanvaBoosterId(member: GuildMember): Promise<Buffer> {
	// Definir dimensiones del canvas (ajusta según tu imagen de fondo)
	const width = 500;
	const height = 350;
	const canvas: Canvas = createCanvas(width, height);
	const ctx = canvas.getContext("2d");

	// Ruta a la imagen de fondo
	const backgroundPath = path.join(__dirname, "../../assets/Images", "boost.png");

	// Cargar y dibujar la imagen de fondo
	try {
		const backgroundImage: Image = await loadImage(backgroundPath);
		ctx.drawImage(backgroundImage, 0, 0, width, height);
	} catch (error) {
		console.error("Error al cargar la imagen de fondo:", error);
		ctx.fillStyle = "#2C2F33";
		ctx.fillRect(0, 0, width, height);
	}

	// Definir dimensiones y posición del avatar
	const avatarSize = 80;
	const avatarX = (width - avatarSize) / 2;
	const avatarY = 10 + (height - avatarSize) / 2 - avatarSize / 2;

	// Cargar la imagen del avatar del miembro
	const avatarURL = member.user.displayAvatarURL({ extension: "png", size: 512 });
	let avatarImage: Image;

	try {
		avatarImage = await loadImage(avatarURL);
	} catch (error) {
		console.error("Error al cargar el avatar del miembro:", error);
		// Opcional: Usar una imagen de avatar predeterminada en caso de fallo
		const defaultAvatarPath = path.join(__dirname, "../../assets/Images", "default-avatar.png");
		avatarImage = await loadImage(member.user.defaultAvatarURL ?? defaultAvatarPath);
	}

	// Dibujar círculo para el avatar
	ctx.save();
	ctx.beginPath();
	ctx.arc(width / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
	ctx.closePath();
	ctx.clip();

	// Dibujar el avatar dentro del círculo
	ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
	ctx.restore();

	// Dibujar el nombre del miembro debajo del avatar
	const displayName = member.user.username;
	ctx.fillStyle = "#FFFFFF"; // Color del texto
	ctx.font = "bold 32px Sans"; // Fuente y tamaño del texto
	ctx.textAlign = "center";
	ctx.textBaseline = "top";
	ctx.fillText(displayName, width / 2, avatarY + avatarSize + 15); // Ajusta la posición según sea necesario

	// (Opcional) Agregar más elementos decorativos aquí, como sombras o efectos

	// Exportar la imagen como buffer PNG
	const buffer: Buffer = canvas.toBuffer("image/png");
	return buffer;
}

export default generateCanvaBoosterId;
