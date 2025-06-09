// src/commands/General/petpet.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, User, UserResolvable } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";

import { img } from "../../utils/canvas/petpet.js";
import parser from "twemoji-parser";
import isSvg from "is-svg";
import fetch from "node-fetch";
import { loadImage } from "@napi-rs/canvas";
import sharp from "sharp";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	data: new SlashCommandBuilder()
		.setName("petpet")
		.setDescription("Acaria una persona.")
		.addStringOption((option) =>
			option.setName("objetivo").setDescription("Usuario, Emoji o URL de la imagen a acariciar.").setRequired(true)
		)
		.addIntegerOption((option) => option.setName("fps").setDescription("Frames por segundo para la animación (2-60).").setRequired(false)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			// Obtener opciones
			const targetOption = interaction.options.getString("objetivo", true);
			let fpsOption = interaction.options.getInteger("fps");

			// Validar y ajustar FPS
			let fps = 16; // Valor por defecto
			if (fpsOption !== null) {
				if (fpsOption < 2 || fpsOption > 60) return await replyError(interaction, `FPS inválidos. Solo se permite entre 2 y 60.`);
				fps = fpsOption;
			}

			const delay = Math.floor(1000 / fps);

			try {
				// Determinar la fuente de la imagen
				let source: string | Buffer | undefined;

				// Expresión regular para detectar menciones de usuario
				const mentionMatch: RegExpExecArray | null = RegExp(/^<@?(\d+)>$/).exec(targetOption);

				if (mentionMatch !== null) {
					// Si es una mención de usuario, extraer el ID y obtener el usuario
					const userId = mentionMatch[1];
					const fetchedUser = await interaction.client.users.fetch(userId).catch(() => null);
					if (fetchedUser) {
						source = fetchedUser.displayAvatarURL({ extension: "png", size: 512 });
					} else {
						return await replyError(interaction, `No se encontró un usuario válido con la ID proporcionada.`);
					}
				} else {
					// Verificar si el objetivo es un emoji
					const parsedEmoji = parser.parse(targetOption, { assetType: "png" });
					if (parsedEmoji.length > 0) {
						source = parsedEmoji[0].url;
					} else {
						// Verificar si el objetivo es una URL de imagen
						const urlPattern =
							/^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()!@:%_+.~#?&//=]*)$/gm;
						if (urlPattern.test(targetOption)) {
							source = targetOption;
						} else {
							// Intentar buscar un usuario por ID, nombre o tag
							const fetchedUser = await interaction.client.users.fetch(targetOption).catch(() => null);
							if (fetchedUser) {
								source = fetchedUser.displayAvatarURL({ extension: "png", size: 512 });
							} else {
								return await replyError(interaction, `No se encontró un usuario, emoji o URL de imagen válido.`);
							}
						}
					}
				}

				if (!source) return await replyError(interaction, `No se pudo determinar la fuente de la imagen.`);

				// Validar la URL de la imagen
				if (typeof source === "string" && !/^https?:\/\/.+\.(png|jpe?g|gif|svg)(\?.*)?$/i.test(source)) {
					return await replyError(interaction, `Formato de imagen inválido. Debe ser PNG, JPEG, GIF o SVG.`);
				}

				// Obtener la imagen
				let imageBuffer: Buffer;
				if (typeof source === "string") {
					const res = await fetch(source).catch(() => undefined);
					if (!res) return await replyError(interaction, `No se pudo obtener la imagen desde la URL proporcionada.`);

					const arrayBuffer = await res.arrayBuffer();
					imageBuffer = Buffer.from(arrayBuffer);
				} else {
					imageBuffer = source;
				}

				// Convertir SVG a PNG si es necesario
				if (isSvg(imageBuffer.toString())) {
					imageBuffer = await sharp(imageBuffer).png().resize(112, 112).toBuffer();
				}

				// Cargar la imagen con Canvas
				const torender = await loadImage(imageBuffer);
				const processedImage = await img(torender, delay);

				// Crear el attachment para el GIF
				const attachment = new AttachmentBuilder(processedImage, { name: "petpet.gif" });

				await replyOk(interaction, [], undefined, undefined, [attachment], undefined, false);
			} catch (error) {
				console.error("Error en el comando petpet:", error);
				await replyError(
					interaction,
					`Hubo un error procesando tu solicitud. Asegúrate de que el formato de la imagen sea válido y vuelve a intentarlo.`
				);
			}
		}
	),
} as Command;
