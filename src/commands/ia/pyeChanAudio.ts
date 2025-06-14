import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";
import loadEnvVariables from "../../utils/environment.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { createAudioErrorEmbed, generateAudioResponse } from "../../utils/ai/aiResponseService.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import fs from "fs";

loadEnvVariables();

export default {
	group: "🤖 - Inteligencia Artificial",
	data: new SlashCommandBuilder()
		.setName("pyechan-audio")
		.setDescription("Habla con PyE Chan y responderá por audio")
		.addStringOption((option) => option.setName("mensaje").setDescription("Qué quieres decirme").setRequired(true).setMaxLength(200)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false), verifyCooldown("pyechan", 1000)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const mensajeInput = interaction.options.getString("mensaje", true) ?? "";

			const response = await generateAudioResponse("Say, " + mensajeInput, interaction.user.id);
			if (response.audio) {
				const fileName = `generated_audio${Date.now()}.mp3`;
				fs.writeFileSync(fileName, new Uint8Array(response.audio));

				const attachment = new AttachmentBuilder(fileName, { name: "🩵pyechan🩵.mp3" });
				await interaction
					.editReply({
						files: [attachment],
					})
					.catch(null)
					.finally(() => {
						fs.unlinkSync(fileName);
					});
			} else {
				const fileName = `generated_audio${Date.now()}.wav`;
				const audioResponse = await synthesizeTextToAudio(response.text).catch(() => null);

				if (!audioResponse) {
					await interaction.editReply({ embeds: [createAudioErrorEmbed()] }).catch(null);
					return;
				}

				const buffer = Buffer.from(audioResponse, "base64");
				// Crea un Uint8Array usando el ArrayBuffer subyacente del buffer
				const uint8array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
				fs.writeFileSync(fileName, uint8array);

				const attachment = new AttachmentBuilder(fileName, { name: "🩵pyechan🩵.wav" });
				await interaction
					.editReply({
						files: [attachment],
					})
					.catch(null)
					.finally(() => {
						fs.unlinkSync(fileName);
					});
			}
		}
	),
	prefixResolver: (client: ExtendedClient) => {
		return new PrefixChatInputCommand(
			client,
			"pyechan-audio",
			[
				{
					name: "mensaje",
					required: true,
					infinite: true,
				},
			],
			["pyeaudio", "iaska"]
		);
	},
} as Command;

async function synthesizeTextToAudio(text: string): Promise<string> {
	const response = await fetch("https://text.pollinations.ai/openai", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			model: "openai-audio",
			modalities: ["text", "audio"],
			audio: { voice: "sage", format: "wav" },
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "Convert this text to audio: " + text }],
				},
			],
		}),
	});
	const data = (await response.json()) as any;
	if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.audio) {
		throw new Error("Respuesta inesperada de la API: " + JSON.stringify(data));
	}
	return data.choices[0].message.audio.data;
}
