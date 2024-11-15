// src/commands/Currency/proposals.ts
import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember, User, Guild } from "discord.js";
import { Users } from "../../Models/User.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { COLORS, getChannelFromEnv } from "../../utils/constants.ts";

export default {
	group: "💍 - Matrimonios (Casino)",
	data: new SlashCommandBuilder()
		.setName("proposals")
		.setDescription("Revisa tu lista de propuestas de matrimonio.")
		.addUserOption((option) =>
			option.setName("usuario").setDescription("La persona cuyo lista de propuestas deseas revisar.").setRequired(false)
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const targetUser: User | null = interaction.options.getUser("usuario") || interaction.user;
			const guild = interaction.guild as Guild;

			const member: GuildMember | undefined = guild.members.cache.get(targetUser.id);
			if (!member) return await replyError(interaction, "No se pudo encontrar al usuario especificado en este servidor.");

			// Obtener los datos del usuario objetivo
			let userData = await Users.findOne({ id: targetUser.id }).exec();
			if (!userData) userData = await Users.create({ id: targetUser.id });

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
						.setColor(COLORS.errRed)
						.setTimestamp(),
				]);

			// Fetch user tags for each proposal
			const proposalTags: string[] = await Promise.all(
				proposals.map(async (id) => {
					try {
						const proposer = await guild.members.fetch(id);
						return `**${proposer.user.tag}**`;
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
				.setColor(COLORS.okGreen)
				.setTimestamp();

			return await replyOk(interaction, [proposalsEmbed]);
		}
	),
};
