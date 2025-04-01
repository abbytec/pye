import { ChannelType, ChatInputCommandInteraction, SlashCommandBuilder, TextChannel } from "discord.js";
import { getHelpForumsIdsFromEnv } from "../../utils/constants.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";

export const data = new SlashCommandBuilder()
	.setName("userposts")
	.setDescription("Lista todos los posts activos creados por un usuario en los foros.")
	.addUserOption((option) => option.setName("usuario").setDescription("El usuario del que querés ver los posts").setRequired(false));

export const execute = composeMiddlewares(
	[
		verifyIsGuild(process.env.GUILD_ID ?? ""),
		verifyCooldown("userposts", 20000, undefined, true, process.env.CLIENT_ID),
		deferInteraction(false),
	],
	async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
		const user = (await interaction.options.getUser("usuario", false)) ?? interaction.user;
		const forumIds = getHelpForumsIdsFromEnv();
		const channels = await Promise.all(
			forumIds.map(
				async (id) =>
					interaction.guild?.channels.cache.get(id) ?? (await interaction.guild?.channels.fetch(id, { cache: true }).catch(() => null))
			)
		);

		const posts: string[] = [];

		await Promise.all(
			channels.map(async (channel) => {
				if (channel?.type !== ChannelType.GuildForum) return;
				const threads = await channel.threads.fetchActive(false).catch(() => null);
				if (!threads) return;
				for (const [id, thread] of threads.threads) {
					if (thread.ownerId === user.id) {
						posts.push(`[${thread.name}](https://discord.com/channels/${interaction.guild?.id}/${thread.id})`);
					}
				}
			})
		);

		if (posts.length === 0) {
			return replyWarning(interaction, `No se encontraron posts activos del usuario ${user.tag} en los foros.`);
		}

		const chunks = posts.slice(0, 10).join("\n"); // limitar respuesta inicial
		return await replyInfo(interaction, `Posts encontrados de **${user.tag}**:\n${chunks}`);
	}
);
