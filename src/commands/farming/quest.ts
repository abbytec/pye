// src/commands/Currency/quests.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember, User, Guild } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { Home, IHomeDocument } from "../../Models/Home.js";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { levels, MAX_LEVEL } from "../../utils/levelsconfig.js";

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
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<void> => {
			const subcommand = interaction.options.getSubcommand();

			if (subcommand === "check") {
				const userOption = await interaction.options.getUser("usuario");
				const user: User = userOption ?? interaction.user;
				const member: GuildMember | null = userOption
					? await (interaction.guild as Guild).members.fetch(user.id).catch(() => null)
					: (interaction.member as GuildMember);

				if (!member) return replyError(interaction, "No se pudo encontrar al usuario especificado.");
				if (member.user.bot) return replyError(interaction, "Los bots no pueden tener un perfil.");

				const data = await Home.findOne({ id: member.id });
				if (!data)
					return replyError(
						interaction,
						user.id === interaction.user.id ? "Aún no tienes un perfil de economía." : "Aún no tiene un perfil de economía."
					);

				const embed = new EmbedBuilder()
					.setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() })
					.setTimestamp()
					.setColor(COLORS.okGreen);

				if (data.house.level >= 1 && data.house.level <= MAX_LEVEL) {
					const levelConfig = levels.find((l) => l.level === data.house.level);
					if (levelConfig) {
						const progressParts = [];
						if (levelConfig.requirements.money) {
							progressParts.push(
								`${pyecoin} \`PyE coins\` ${
									levelConfig.game ? "(En Juegos)" : ""
								}: ${data.money.toLocaleString()} / ${levelConfig.requirements.money().toLocaleString()}`
							);
						}
						if (levelConfig.requirements.bump)
							progressParts.push(`👍 \`Bumps\`: ${data.bump.toLocaleString()} / ${levelConfig.requirements.bump}`);
						if (levelConfig.requirements.text)
							progressParts.push(`💬 \`Mensajes\`: ${data.text.toLocaleString()} / ${levelConfig.requirements.text}`);
						if (levelConfig.requirements.rep)
							progressParts.push(
								`<:pyestar:1313345160549105774> \`Reputación\`: ${data.rep.toLocaleString()} / ${levelConfig.requirements.rep}`
							);
						embed.addFields({ name: `Tarea #${levelConfig.level}`, value: progressParts.join("\n") });
					}
				} else {
					embed.setDescription("Todas las tareas han sido completadas.");
				}
				if (!data.active && data.house.level <= MAX_LEVEL)
					embed.addFields({ name: "Información", value: `Puedes usar \`/quest start\` para iniciar la tarea.` });

				return replyOk(interaction, [embed]);
			} else if (subcommand === "start") {
				const user: User = interaction.user;
				const member: GuildMember | null = interaction.member instanceof GuildMember ? interaction.member : null;
				if (!member) return replyError(interaction, "No se pudo encontrar tu información de miembro.");

				const data = await Home.findOne({ id: user.id });
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
			return replyError(interaction, "Comando no reconocido.");
		}
	),
};
