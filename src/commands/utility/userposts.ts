import { ChannelType, SlashCommandBuilder } from "discord.js";
import { getHelpForumsIdsFromEnv, ChannelKeys } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";

export const data = new SlashCommandBuilder()
	.setName("userposts")
	.setDescription("Lista todos los posts activos creados por un usuario en los foros.")
	.addStringOption((option) =>
		option
			.setName("foro")
			.setDescription("Selecciona el foro a consultar")
			.setRequired(true)
			.addChoices(
				{ name: "Hardware", value: "hardware" },
				{ name: "Linux", value: "linux" },
				{ name: "Go", value: "go" },
				{ name: "Bases de Datos", value: "bases-de-datos" },
				{ name: "Redes", value: "redes" },
				{ name: "Seguridad Informática", value: "seguridad-informática" },
				{ name: "Windows", value: "windows" },
				{ name: "Electrónica", value: "electrónica" },
				{ name: "Game Dev", value: "game-dev" },
				{ name: "Ayuda General", value: "ayuda-general" },
				{ name: "JavaScript", value: "javascript" },
				{ name: "Rust", value: "rust" },
				{ name: "Python", value: "python" },
				{ name: "C#/.NET", value: "c-sharp-dotnet" },
				{ name: "C/C++", value: "c-cpp" },
				{ name: "HTML/CSS", value: "html-css" },
				{ name: "PHP", value: "php" },
				{ name: "Java/Kotlin", value: "java-kotlin" },
				{ name: "Matemáticas", value: "matemáticas" }
			)
	)
	.addUserOption((option) => option.setName("usuario").setDescription("El usuario del que querés ver los posts").setRequired(false));

export const execute = composeMiddlewares(
	[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("userposts", 10000, undefined, true), deferInteraction(false)],
	async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
		const user = (await interaction.options.getUser("usuario", false)) ?? interaction.user;
		const forumOption = interaction.options.getString("foro", true);
		const forumIds = getHelpForumsIdsFromEnv(forumOption as ChannelKeys);
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
