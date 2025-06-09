// src/utils/canvas/petpet.ts
import path, { dirname } from "path";
import GIFEncoder from "gif-encoder";
import { createCanvas, Image, loadImage } from "@napi-rs/canvas";
import { fileURLToPath } from "url";
import { COLORS } from "../constants.js";

const SIZE = 112;

// Configuración global
interface FrameConfig {
	delay: number;
	x: number;
	y: number;
	w: number;
	h: number;
	scale: number;
	frame: number;
}

const g: FrameConfig = {
	delay: 63,
	x: 18,
	y: 18,
	w: 112,
	h: 112,
	scale: 0.875,
	frame: 0,
};

// Variable para almacenar el sprite cargado
let sprite: Image | null = null;

/**
 * Obtiene los datos de un frame basado en el índice.
 * @param i Índice del frame
 * @returns Objeto con datos de posición y tamaño
 */
function getFrame(i: number): { x: number; y: number; w: number; h: number } {
	const frames = [
		{ x: g.x, y: g.y, w: g.w * g.scale, h: g.h * g.scale },
		{ x: g.x - 4, y: g.y + 12, w: g.w * g.scale + 4, h: g.h * g.scale - 12 },
		{ x: g.x - 12, y: g.y + 18, w: g.w * g.scale + 12, h: g.h * g.scale - 18 },
		{ x: g.x - 12, y: g.y + 12, w: g.w * g.scale + 4, h: g.h * g.scale - 12 },
		{ x: g.x - 4, y: g.y, w: g.w * g.scale, h: g.h * g.scale },
	];
	return frames[i];
}

/**
 * Remueve píxeles parcialmente transparentes y verdes (#00ff00) de una imagen.
 * @param data Datos de la imagen en formato RGBA
 */
function optimizeFrameColors(data: Uint8ClampedArray): void {
	for (let i = 0; i < data.length; i += 4) {
		// Clampea el canal verde para evitar verdes puros que se vuelvan transparentes
		data[i + 1] = data[i + 1] > 250 ? 250 : data[i + 1];
		// Clampea la transparencia
		data[i + 3] = data[i + 3] > 127 ? 255 : 0;
	}
}

/**
 * Renderiza un GIF a partir de las imágenes proporcionadas.
 * @param sprite Imagen del sprite
 * @param character Imagen del personaje
 * @param frames Datos de los frames
 * @param size Tamaño del GIF
 * @param delay Retardo entre frames en milisegundos
 * @returns Promesa que resuelve con el buffer del GIF generado
 */
function render(
	sprite: Image,
	character: Image,
	frames: Array<{ x: number; y: number; w: number; h: number }>,
	size: number,
	delay: number
): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		try {
			// Canvas para renderizar los frames del GIF
			const renderCanvas = createCanvas(size, size);
			const renderCtx = renderCanvas.getContext("2d");

			// Canvas para optimizar los colores del GIF
			const tempCanvas = createCanvas(size, size);
			const tempCtx = tempCanvas.getContext("2d");

			// Configuración de los GIF frames
			const gif = new GIFEncoder(size, size);
			gif.setDelay(delay);
			gif.setTransparent(COLORS.okGreen);
			gif.setRepeat(0);

			const chunks: Buffer[] = [];
			gif.on("data", (chunk: Buffer) => chunks.push(chunk));
			gif.on("end", () => {
				const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
				const result = new Uint8Array(totalLength);
				let offset = 0;
				for (const arr of chunks) {
					result.set(arr, offset);
					offset += arr.length;
				}
				resolve(Buffer.from(result));
			});

			frames.forEach((frameData, frameIndex) => {
				// Limpiar los canvas
				tempCtx.clearRect(0, 0, size, size);
				renderCtx.fillStyle = "#0f0";
				renderCtx.fillRect(0, 0, renderCanvas.width, renderCanvas.height);

				// Dibujar el frame en el canvas temporal
				tempCtx.drawImage(character, frameData.x, frameData.y, frameData.w, frameData.h);
				tempCtx.drawImage(sprite, frameIndex * size, 0, size, size, 0, 0, size, size);

				// Optimizar los colores del frame
				const imgData = tempCtx.getImageData(0, 0, renderCanvas.width, renderCanvas.height);
				optimizeFrameColors(imgData.data);
				tempCtx.putImageData(imgData, 0, 0);

				// Dibujar el frame optimizado en el canvas de renderizado
				renderCtx.drawImage(tempCanvas, 0, 0);

				// Agregar el frame al GIF
				if (frameIndex === 0) {
					gif.writeHeader();
				}
				gif.addFrame(renderCtx.getImageData(0, 0, renderCanvas.width, renderCanvas.height).data);
			});

			// Finalizar el GIF
			gif.finish();
		} catch (error: any) {
			reject(new Error("Error en la renderización del GIF." + error.message));
		}
	});
}

/**
 * Genera un GIF de PetPet a partir de una imagen y un delay opcional.
 * @param toConvert Imagen del personaje a acariciar
 * @param dy Retardo entre frames en milisegundos (opcional)
 * @returns Promesa que resuelve con el buffer del GIF generado
 */
async function img(toConvert: Image, dy: number = g.delay): Promise<Buffer> {
	if (!sprite) {
		sprite = await loadImage(path.join(dirname(fileURLToPath(import.meta.url)), "../assets/Pictures/sprite.png"));
	}

	const frames = [0, 1, 2, 3, 4].map(getFrame);
	const gifBuffer = await render(sprite, toConvert, frames, SIZE, dy);
	return gifBuffer;
}

export { img };
