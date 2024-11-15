// src/commands/Currency/quests.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember, User } from "discord.js";

import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { Home, IHomeDocument } from "../../Models/Home.ts";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.ts";

// Definición de las tareas según el nivel
const tasks: Array<{
	name: string;
	description: string;
	progress: (data: IHomeDocument) => string;
}> = [
	// Nivel 1
	{
		name: "Tarea #1",
		description: "Recolectar 3k PyE coins.",
		progress: (data) => `${pyecoin} \`PyE coins\`: ${data.money.toLocaleString()} / 3,000`,
	},
	// Nivel 2
	{
		name: "Tarea #2",
		description: "Recolectar 10k PyE coins.",
		progress: (data) => `${pyecoin} \`PyE coins\`: ${data.money.toLocaleString()} / 10,000`,
	},
	// Nivel 3
	{
		name: "Tarea #3",
		description: "Ganar 10k PyE coins solamente con los juegos.",
		progress: (data) => `${pyecoin} \`PyE coins\`: ${data.money.toLocaleString()} / 10,000`,
	},
	// Nivel 4
	{
		name: "Tarea #4",
		description: "Recolectar 15k PyE coins + 1 bump.",
		progress: (data) => `${pyecoin} \`PyE coins\`: ${data.money.toLocaleString()} / 15,000\n👍 \`Bumps\`: ${data.bump.toLocaleString()} / 1`,
	},
	// Nivel 5
	{
		name: "Tarea #5",
		description: "300 comentarios en el servidor.",
		progress: (data) => `💬 \`Mensajes\`: ${data.text.toLocaleString()} / 300`,
	},
	// Nivel 6
	{
		name: "Tarea #6",
		description: "Recolectar 30k PyE coins.",
		progress: (data) => `${pyecoin} \`PyE coins\`: ${data.money.toLocaleString()} / 30,000`,
	},
	// Nivel 7
	{
		name: "Tarea #7",
		description: "Ganar 30k PyE coins solamente con los juegos.",
		progress: (data) => `${pyecoin} \`PyE coins\`: ${data.money.toLocaleString()} / 30,000`,
	},
	// Nivel 8
	{
		name: "Tarea #8",
		description: "500 comentarios en el servidor.",
		progress: (data) => `💬 \`Mensajes\`: ${data.text.toLocaleString()} / 500`,
	},
	// Nivel 9
	{
		name: "Tarea #9",
		description: "Recolectar 50k PyE coins + 2 bumps + 1 punto rep.",
		progress: (data) =>
			`${pyecoin} \`PyE coins\`: ${data.money.toLocaleString()} / 50,000\n👍 \`Bumps\`: ${data.bump.toLocaleString()} / 2\n<:pyestar:926334569903435776> \`Puntos de reputación\`: ${data.rep.toLocaleString()} / 1`,
	},
	// Nivel 10
	{
		name: "Tarea #10",
		description: "Ganar 50k PyE coins solamente con los juegos.",
		progress: (data) => `${pyecoin} \`PyE coins\`: ${data.money.toLocaleString()} / 50,000`,
	},
	// Nivel 11
	{
		name: "Tarea #11",
		description: "Recolectar 100k PyE coins + 2 puntos rep.",
		progress: (data) =>
			`${pyecoin} \`PyE coins\`: ${data.money.toLocaleString()} / 100,000\n<:pyestar:926334569903435776> \`Puntos de reputación\`: ${data.rep.toLocaleString()} / 2`,
	},
	// Nivel 12
	{
		name: "Tarea #12",
		description: "1k comentarios en el servidor.",
		progress: (data) => `💬 \`Mensajes\`: ${data.text.toLocaleString()} / 1,000`,
	},
];

export default {
	group: "💰 - Farmeo de PyeCoins (Casino)",
	data: new SlashCommandBuilder()
		.setName("quest")
		.setDescription("Revisa el progreso de los quests o inicia una nueva tarea.")
		.addSubcommand((subcommand) =>
			subcommand
				.setName("check")
				.setDescription("Revisa el progreso de los quests.")
				.addUserOption((option) => option.setName("usuario").setDescription("El usuario para revisar los quests.").setRequired(false))
		)
		.addSubcommand((subcommand) => subcommand.setName("start").setDescription("Inicia una nueva tarea de quest.")),

	execute: composeMiddlewares(
		[
			verifyIsGuild(process.env.GUILD_ID ?? ""),
			verifyChannel(getChannelFromEnv("casinoPye")), // Asegúrate de que "casinoPye" sea el canal correcto para los quests
			deferInteraction(false),
		],
		async (interaction: ChatInputCommandInteraction): Promise<void> => {
			const subcommand = interaction.options.getSubcommand();

			if (subcommand === "check") {
				const userOption = interaction.options.getUser("usuario");
				const user: User = userOption ?? interaction.user;
				const member: GuildMember | null | undefined = userOption
					? await interaction.guild?.members.fetch(user.id).catch(() => null)
					: (interaction.member as GuildMember);

				if (!member) return replyError(interaction, "No se pudo encontrar al usuario especificado.");

				if (member.user.bot) return replyError(interaction, "Los bots no pueden tener un perfil.");

				const data = await Home.findOne({ id: member.id }).exec();

				if (!data)
					return replyError(
						interaction,
						user.id === interaction.user.id ? "Aún no tienes un perfil de economía." : "Aún no tiene un perfil de economía."
					);

				const embed = new EmbedBuilder()
					.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
					.setTimestamp()
					.setColor(COLORS.okGreen);

				if (data.house.level >= 1 && data.house.level <= 12) {
					const task = tasks[data.house.level - 1];
					embed.addFields({ name: task.name, value: task.description }, { name: "Progreso", value: task.progress(data) });
				} else {
					embed.setDescription("Todas las tareas han sido completadas.");
				}

				if (!data.active && data.house.level <= 12)
					embed.addFields({ name: "Información", value: `Puedes usar \`/quest start\` para iniciar la tarea.` });

				return replyOk(interaction, [embed]);
			} else if (subcommand === "start") {
				const user: User = interaction.user;
				const member: GuildMember | null = interaction.member instanceof GuildMember ? interaction.member : null;

				if (!member) return replyError(interaction, "No se pudo encontrar tu información de miembro.");

				const data = await Home.findOne({ id: user.id }).exec();

				if (!data) return replyError(interaction, "Aún no tienes un perfil de economía.");

				if (data.house.level >= 13) return replyOk(interaction, "Todas las tareas han sido completadas.");

				if (data.active) return replyError(interaction, "Ya se encuentra una tarea activa.");

				data.active = true;

				try {
					await data.save();
					return replyOk(interaction, "Tarea activada correctamente.");
				} catch (error) {
					console.error("Error al activar la tarea:", error);
					return replyError(interaction, "Hubo un error al iniciar la tarea. Inténtalo de nuevo más tarde.");
				}
			}

			// En caso de un subcomando no reconocido
			return replyError(interaction, "Comando no reconocido.");
		}
	),
};
