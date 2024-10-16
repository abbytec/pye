import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { Command } from "../../types/command";
import { getChannel } from "../../utils/constants";

const data = new SlashCommandBuilder()
	.setName("sugerir")
	.setDescription("Envía tu sugerencia para mejorar el servidor")
	.addStringOption((option) =>
		option.setName("sugerencia").setDescription("qué tienes en mente para el servidor").setMinLength(40).setRequired(true)
	);
async function execute(interaction: ChatInputCommandInteraction) {
	const args = interaction.options.getString("sugerencia");
	let canal = interaction.client.channels.resolve(getChannel("sugerencias")) as TextChannel | null;

	if (!canal?.isTextBased()) {
		await interaction.reply({
			content: "No se pudo encontrar el canal de sugerencias. Por favor, contacta al administrador.",
			ephemeral: true,
		});
		return;
	}

	let suggest = new EmbedBuilder()
		.setColor(0x1414b8)
		.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
		.setTitle("Nueva sugerencia !")
		.setDescription(args)
		.setTimestamp()
		.setFooter({ text: "Puedes votar a favor o en contra de esta sugerencia" });

	interaction.reply("<:check:1282933528580849664> - Se ha enviado tu sugerencia correctamente.");

	canal
		?.send({
			embeds: [suggest],
		})
		.then((message: any) => {
			message.react("1282933528580849664").catch(() => null);
			message.react("1282933529566511155").catch(() => null);
			message
				.startThread({ name: `Sugerencia por ${interaction.user.username}` })
				.then((c: any) => c.send(`<@${interaction.user.id}>`))
				.catch(() => null);
		})
		.catch(() => null);
}

// Exportar el comando implementando la interfaz Command
const sugerirCommand: Command = {
	data,
	execute,
};

export default sugerirCommand;
