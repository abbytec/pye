import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, TextChannel, Message } from "discord.js";
import { Command } from "../../types/command.ts";
import { getChannel } from "../../utils/constants.ts";

const data = new SlashCommandBuilder()
	.setName("sugerir")
	.setDescription("Envía tu sugerencia para mejorar el servidor")
	.addStringOption((option) =>
		option.setName("sugerencia").setDescription("qué tienes en mente para el servidor").setMinLength(40).setRequired(true)
	);

async function sugerir(canal: TextChannel | null, sugerencia: string | null, interaction: ChatInputCommandInteraction | Message) {
	if (!sugerencia) {
		await interaction.reply({
			content: "Por favor, proporciona una sugerencia.",
			ephemeral: true,
		});
	}
	if (!canal?.isTextBased()) {
		await interaction.reply({
			content: "No se pudo encontrar el canal de sugerencias. Por favor, contacta al administrador.",
			ephemeral: true,
		});
		return;
	}

	console.log(sugerencia, interaction);

	let suggest = new EmbedBuilder()
		.setColor(0x1414b8)
		.setTitle("Nueva sugerencia !")
		.setDescription(sugerencia)
		.setTimestamp()
		.setFooter({ text: "Puedes votar a favor o en contra de esta sugerencia" });
	if (interaction instanceof ChatInputCommandInteraction)
		suggest.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });
	else suggest.setAuthor({ name: interaction.member?.user.username ?? "Anonimo", iconURL: interaction.member?.user.displayAvatarURL() });

	interaction.reply("<:check:1282933528580849664> - Se ha enviado tu sugerencia correctamente.");

	canal
		?.send({
			embeds: [suggest],
		})
		.then((message: any) => {
			message.react("1282933528580849664").catch(() => null);
			message.react("1282933529566511155").catch(() => null);
			message
				.startThread({ name: `Sugerencia por ${interaction.member?.user.username}` })
				.then((c: any) => c.send(`<@${interaction.member?.user.id}>`))
				.catch(() => null);
		})
		.catch(() => null);
}

async function execute(interaction: ChatInputCommandInteraction) {
	const args = interaction.options.getString("sugerencia");
	const canal = interaction.client.channels.resolve(getChannel("sugerencias")) as TextChannel | null;

	await sugerir(canal, args, interaction);
}

async function executePrefix(msg: Message, arg: string) {
	const canal = msg.client.channels.resolve(getChannel("sugerencias")) as TextChannel | null;

	await sugerir(canal, arg, msg);
}

// Exportar el comando implementando la interfaz Command
const sugerirCommand: Command = {
	data,
	execute,
	executePrefix,
};

export default sugerirCommand;
