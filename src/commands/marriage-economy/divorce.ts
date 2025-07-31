// src/commands/Currency/divorce.ts
import { SlashCommandBuilder, EmbedBuilder, GuildMember, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, Guild } from "discord.js";
import { Users, IUserModel, getOrCreateUser } from "../../Models/User.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { COLORS, getChannelFromEnv } from "../../utils/constants.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "💍 - Matrimonios (Casino)",
	data: new SlashCommandBuilder()
		.setName("divorce")
		.setDescription("Divórciate de tu matrimonio.")
		.addUserOption((option) => option.setName("usuario").setDescription("La persona de la que deseas divorciarte.").setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;
			const guild = interaction.guild as Guild;

			const targetUser = await interaction.options.getUser("usuario", true);
			if (!targetUser) return;
			const targetMember: GuildMember | undefined = guild.members.cache.get(targetUser.id);

			if (!targetMember) {
				await replyWarning(interaction, "No se pudo encontrar al usuario especificado en este servidor, se procederá con el divorcio.");
				return await processDivorce(user.id, targetUser.id);
			}

			const userData: IUserModel = await getOrCreateUser(user.id);

			if (!userData.couples || userData.couples.length === 0) return await replyError(interaction, "No estás casado.");

			const isMarriedToTarget = userData.couples.some((couple) => couple.user === targetUser.id);

			if (!isMarriedToTarget) return await replyError(interaction, "No estás casado con esa persona.");

			const embed = new EmbedBuilder()
				.setAuthor({
					name: "😬 Propuesta de divorcio",
					iconURL: user.displayAvatarURL(),
				})
				.setDescription(`\`${user.tag}\` quiere divorciarse de \`${targetUser.tag}\`.`)
				.setColor(COLORS.errRed)
				.setTimestamp();

			const acceptButton = new ButtonBuilder().setCustomId("divorce_accept").setLabel("✔").setStyle(ButtonStyle.Success);

			const declineButton = new ButtonBuilder().setCustomId("divorce_decline").setLabel("❌").setStyle(ButtonStyle.Danger);

			const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptButton, declineButton);

			await replyOk(interaction, [embed], undefined, [actionRow], undefined, `<@${targetUser.id}>`);

			const filter = (i: any) => i.user.id === targetUser.id && ["divorce_accept", "divorce_decline"].includes(i.customId);

			try {
				const componentInteraction = await (
					await interaction.fetchReply()
				)?.awaitMessageComponent({
					filter,
					componentType: ComponentType.Button,
					time: 120000, // 120 segundos
				});

				if (componentInteraction.customId === "divorce_accept") {
					await componentInteraction.deferUpdate();
					await processDivorce(user.id, targetUser.id);
					const divorceEmbed = new EmbedBuilder()
						.setAuthor({
							name: `💔 Divorcio entre ${user.tag} y ${targetUser.tag}`,
							iconURL: user.displayAvatarURL(),
						})
						.setDescription(`\`${user.username}\` y \`${targetUser.username}\` se han divorciado.`)
						.setColor(COLORS.errRed)
						.setTimestamp();

					await (
						await interaction.fetchReply()
					).edit({
						embeds: [divorceEmbed],
						components: [],
					});
				} else if (componentInteraction.customId === "divorce_decline") {
					await componentInteraction.update({
						embeds: [
							new EmbedBuilder()
								.setDescription(`\`${targetUser.tag}\` ha rechazado la propuesta de divorcio de \`${user.tag}\`.`)
								.setColor(COLORS.errRed)
								.setTimestamp(),
						],
						components: [],
					});
				}
			} catch {
				return await replyError(interaction, "Se acabó el tiempo...");
			}
		}
	),
} as Command;

async function processDivorce(userId: string, targetUserId: string) {
	const [userData, targetData] = await Promise.all([Users.findOne({ id: userId }), Users.findOne({ id: targetUserId })]);
	if (!userData) return;
	userData.couples = userData.couples.filter((couple) => couple.user !== targetUserId);
	if (targetData) targetData.couples = targetData.couples.filter((couple) => couple.user !== userId);
	await Promise.all([userData.save(), targetData?.save()]);
}
