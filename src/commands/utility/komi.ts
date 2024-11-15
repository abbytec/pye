// src/commands/General/komi.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, Guild } from "discord.js";
import Canvas from "@napi-rs/canvas";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";

// Lista de opciones y sus URLs correspondientes
const defaultImages: Record<string, string> = {
	js: "https://cdn.discordapp.com/attachments/916353103534632965/1024771598844170330/js.jpg",
	javascript: "https://cdn.discordapp.com/attachments/916353103534632965/1024771598844170330/js.jpg",
	py: "https://cdn.discordapp.com/attachments/916353103534632965/1024771600714842142/python.png",
	python: "https://cdn.discordapp.com/attachments/916353103534632965/1024771600714842142/python.png",
	rust: "https://cdn.discordapp.com/attachments/916353103534632965/1024771601767612548/rust.jpg",
	linux: "https://cdn.discordapp.com/attachments/916353103534632965/1024771600324776007/linux.png",
	php: "https://cdn.discordapp.com/attachments/916353103534632965/1024771599871787108/php.png",
	kotlin: "https://cdn.discordapp.com/attachments/916353103534632965/1024771601209774130/kotlin.jpg",
	csharp: "https://cdn.discordapp.com/attachments/916353103534632965/1024771599351676948/csharp.jpg",
	"c#": "https://cdn.discordapp.com/attachments/916353103534632965/1024771599351676948/csharp.jpg",
	bash: "https://cdn.discordapp.com/attachments/916353103534632965/1024771598324072600/bash.jpg",
};

// Lista de opciones válidas
const validOptions = Object.keys(defaultImages);

export default {
	data: new SlashCommandBuilder()
		.setName("komi")
		.setDescription("Envia una imagen de komi con texto personalizado o selecciona una opción predefinida.")
		.addStringOption((option) =>
			option.setName("texto").setDescription("Texto u opción predefinida ('list' para ver las opciones).").setRequired(true)
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const textoInput = interaction.options.getString("texto", true)?.trim();
			const user = interaction.user;
			const guild = interaction.guild as Guild;

			// Si el usuario solicita la lista de opciones
			if (/^(list|lista)$/i.test(textoInput)) {
				const optionsList = validOptions.map((opt) => `❥ \`${opt}\` | \`${opt === "csharp" ? "c#" : opt}\``).join("\n");
				const listEmbed = new EmbedBuilder()
					.setTitle("__**Lista de Opciones**__")
					.setDescription(optionsList || "No hay opciones disponibles en este momento.")
					.setColor(0x00ae86)
					.setTimestamp();
				return await replyOk(interaction, [listEmbed]);
			}

			// Si el texto corresponde a una opción válida y no hay texto adicional
			const firstArg = textoInput.split(" ")[0].toLowerCase();
			if (validOptions.includes(firstArg) && textoInput.split(" ").length === 1) {
				const imageUrl = defaultImages[firstArg];
				if (!imageUrl) return await replyError(interaction, "Opción inválida. Usa `/komi list` para ver las opciones disponibles.");
				const attachment = new AttachmentBuilder(imageUrl, { name: "komi.png" });
				return await replyOk(interaction, `${user}`, undefined, undefined, [attachment]);
			}

			// Generar una imagen personalizada con el texto proporcionado
			// Cargar la imagen de fondo
			const canvas = Canvas.createCanvas(640, 480);
			const ctx = canvas.getContext("2d");
			const backgroundImage = await Canvas.loadImage(
				"https://cdn.discordapp.com/attachments/916353103534632965/1024771597669781565/normal.png"
			);
			ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

			// Procesar el texto
			let texto = textoInput;

			// Reemplazar menciones por nombres de usuario
			const mentions = interaction.options.getString("texto")?.match(/<@!?(\d+)>/g) || [];
			for (const mention of mentions) {
				const id = mention.replace(/<@!?/, "").replace(/>/, "");
				const member = await guild.members.fetch(id).catch(() => null);
				if (member) texto = texto.replace(mention, member.user.username);
			}

			// Validaciones de texto
			if (!texto || /discord\.gg|\.gg\/|\//i.test(texto)) texto = "discord.gg/programacion";

			const isDefaultText = texto === "discord.gg/programacion";

			if (texto.length > 240) return await replyError(interaction, "No puedes ingresar más de 240 caracteres.");

			// Dividir el texto en líneas si es necesario
			const maxCharsPerLine = 22;
			const lines: string[] = [];
			for (let i = 0; i < texto.length; i += maxCharsPerLine) {
				lines.push(texto.substring(i, i + maxCharsPerLine));
			}
			const finalText = lines.join("\n");

			// Configurar la fuente y estilo
			ctx.font = `bold ${isDefaultText ? 25 : 20}px Manrope`;
			ctx.fillStyle = "#090a09";
			ctx.textAlign = "center";

			// Determinar la posición del texto
			const textX = 320; // Centro del canvas
			const textY = isDefaultText ? 350 : 180;

			// Dibujar el texto en el canvas
			ctx.fillText(finalText, textX, textY);

			const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "komi.png" });

			return await replyOk(interaction, "", undefined, undefined, [attachment]);
		}
	),
};
