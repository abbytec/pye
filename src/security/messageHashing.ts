import { createHash } from "crypto";

/**
 * Calcula el hash SHA-256 de una cadena de texto.
 * @param message El contenido del mensaje a hashear.
 * @returns El hash en formato hexadecimal.
 */
export function hashMessage(message: string): string {
	return createHash("sha256").update(message, "utf8").digest("hex");
}
