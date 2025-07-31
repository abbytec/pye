// src/commands/Currency/proposals.ts
import { SlashCommandBuilder, EmbedBuilder, GuildMember, User, Guild } from "discord.js";
import { getOrCreateUser } from "../../Models/User.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "💍 - Matrimonios (Casino)",
	data: new SlashCommandBuilder()
		.setName("proposals")
		.setDescription("Revisa tu lista de propuestas de matrimonio.")
		.addUserOption((option) =>
			option.setName("usuario").setDescription("La persona cuyo lista de propuestas deseas revisar.").setRequired(false)
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const targetUser: User | null = (await interaction.options.getUser("usuario")) || interaction.user;
			const guild = interaction.guild as Guild;

			const member: GuildMember | undefined = guild.members.cache.get(targetUser.id);
			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario especificado en este servidor.");

			// Obtener los datos del usuario objetivo
			const userData = await getOrCreateUser(targetUser.id);

			// Obtener las propuestas de matrimonio
			const proposals = userData.proposals;

			// Si no hay propuestas
			if (!proposals || proposals.length === 0)
				return await replyOk(interaction, [
					new EmbedBuilder()
						.setAuthor({
							name: `💍 Propuestas de matrimonio de ${member.user.tag}`,
							iconURL: member.user.displayAvatarURL(),
						})
						.setDescription("No tiene propuestas de matrimonio.")
						.setColor(COLORS.warnOrange)
						.setTimestamp(),
				]);

			// Fetch user tags for each proposal
			const proposalTags: string[] = await Promise.all(
				proposals.map(async (id) => {
					try {
						const proposer = await guild.members.fetch(id).catch(() => undefined);
						return `**${proposer?.user.tag ?? "Desconocido"}**`;
					} catch {
						return `**ID: ${id}**`;
					}
				})
			);

			// Crear el embed con las propuestas
			const proposalsEmbed = new EmbedBuilder()
				.setAuthor({
					name: `💍 Propuestas de matrimonio de ${member.user.tag}`,
					iconURL: member.user.displayAvatarURL(),
				})
				.setDescription(proposalTags.join("\n"))
				.setColor(COLORS.pyeLightBlue)
				.setTimestamp();

			return await replyOk(interaction, [proposalsEmbed]);
		}
	),
} as Command;
