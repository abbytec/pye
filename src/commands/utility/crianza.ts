// src/commands/General/crianza.ts
import { SlashCommandBuilder, ChatInputCommandInteraction, AttachmentBuilder, GuildMember } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { loadImage, createCanvas } from "@napi-rs/canvas";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export default {
	data: new SlashCommandBuilder()
		.setName("crianza")
		.setDescription("Envía una imagen de un meme para criar hijos.")
		.addStringOption((option) => option.setName("texto").setDescription("Texto que quieres incluir en el meme.").setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<void> => {
			const canvas = createCanvas(565, 637);
			const ctx = canvas.getContext("2d");

			const backgroundImage = await loadImage(path.join(__dirname, `../../assets/Images/crianza.png`)); // https://i.imgur.com/jiEe1xQ.png
			ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

			const texto = interaction.options.getString("texto", true);

			let text = texto;
			if (!text || ["discord.gg", ".gg/", "/"].some((str) => text.includes(str))) {
				text = "Staff de discord";
			}

			// Verificar la longitud del texto
			if (text.length > 16) {
				await replyError(interaction, "No puedes ingresar más de 16 caracteres. Inténtalo de nuevo.");
				return;
			}

			// Dividir texto en líneas para ajustarlo al canvas
			const maxLineLength = 16;
			const splitText = text
				.split("")
				.reduce((acc, char, index) => {
					if (index > 0 && index % maxLineLength === 0) acc.push("\n");
					acc.push(char);
					return acc;
				}, [] as string[])
				.join("");

			// Estilo del texto
			ctx.font = "bold 32px Manrope";
			ctx.fillStyle = "#2F251B";
			ctx.textAlign = "center";
			const rotation = 3 * (Math.PI / 180); // Rotación en radianes
			ctx.rotate(rotation);
			ctx.fillText(splitText, 315, 276); // Coordenadas ajustadas al diseño del meme

			// Crear y enviar la imagen como adjunto
			const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "buenacrianza.png" });
			await interaction.editReply({ files: [attachment] });
		}
	),
} as Command;
