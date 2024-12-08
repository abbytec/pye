import { SlashCommandBuilder, EmbedBuilder, ChatInputCommandInteraction, TextChannel, Message } from "discord.js";
import { COLORS, getChannel } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

const data = new SlashCommandBuilder()
	.setName("sugerir")
	.setDescription("Envía tu sugerencia para mejorar el servidor")
	.addStringOption((option) =>
		option.setName("sugerencia").setDescription("qué tienes en mente para el servidor").setMinLength(40).setRequired(true)
	);

async function sugerir(sugerencia: string | null, interaction: IPrefixChatInputCommand) {
	const canal = (await getChannel(interaction, "sugerencias", true)) as TextChannel | null;

	let suggest = new EmbedBuilder()
		.setColor(COLORS.pyeLightBlue)
		.setTitle("Nueva sugerencia !")
		.setDescription(sugerencia)
		.setTimestamp()
		.setFooter({ text: "Puedes votar a favor o en contra de esta sugerencia" });
	suggest.setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() });

	interaction.reply("<:cross:1282933529566511155> - Se ha enviado tu sugerencia correctamente.");

	canal
		?.send({
			embeds: [suggest],
		})
		.then((message: any) => {
			message.react("1282933528580849664").catch((e: any) => console.error(e));
			message.react("1282933529566511155").catch((e: any) => console.error(e));
			message
				.startThread({ name: `Sugerencia por ${interaction.member?.user.username}` })
				.then((c: any) => c.send(`<@${interaction.member?.user.id}>`))
				.catch((e: any) => console.error(e));
		})
		.catch((e) => console.error(e));
}

async function execute(interaction: IPrefixChatInputCommand) {
	const args = interaction.options.getString("sugerencia");
	await sugerir(args, interaction);
}

// Exportar el comando implementando la interfaz Command
const sugerirCommand: Command = {
	data,
	execute,
};

export default sugerirCommand;
