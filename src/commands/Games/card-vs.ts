import {
	SlashCommandBuilder,
	ChatInputCommandInteraction,
	GuildMember,
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	PermissionFlagsBits,
	TextChannel,
	ThreadChannel,
	ChannelType,
	ComponentType,
	Snowflake,
	Message,
	ButtonInteraction,
} from "discord.js";
import { COLORS, getChannel, getChannelFromEnv } from "../../utils/constants.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyError } from "../../utils/messages/replyError.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import WarStrategy from "../../utils/card-games/WarStrategy.js";
import { GameStrategy } from "../../utils/card-games/IGameStrategy.js";
import { renderCardsAnsi } from "../../utils/card-games/CardUtils.js";
import { GameRuntime } from "../../utils/card-games/GameRuntime.js";

export const games: GameStrategy[] = [new WarStrategy()];
export const getGame = (name: string) => games.find((g) => g.name === name);
export const listGames = () => games.map((g) => g.name);

export default {
	data: new SlashCommandBuilder()
		.setName("card-vs")
		.setDescription("Inicia una partida de cartas contra otro(s) jugador(es)")
		.addStringOption((opt) =>
			opt
				.setName("juego")
				.setDescription(`Juego (${listGames().join(", ") || "registrarGame(new Estrategia)"})`)
				.setRequired(true)
				.addChoices(
					...listGames()
						.slice(0, 25)
						.map((g) => ({ name: g, value: g }))
					// Discord permite hasta 25 choices
				)
		)
		.addUserOption((opt) => opt.setName("oponente1").setDescription("Primer oponente").setRequired(true))
		.addUserOption((opt) => opt.setName("oponente2").setDescription("Segundo oponente").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), verifyCooldown("card-game", 180000)],
		async function execute(interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> {
			const gameName = interaction.options.getString("juego", true);
			const strat = getGame(gameName);
			if (!strat) return replyError(interaction, "Juego desconocido.");

			const opp1 = await interaction.options.getUser("oponente1", true);
			const opp2 = await interaction.options.getUser("oponente2", false);

			if (!opp1) return replyError(interaction, "No se pudo encontrar al oponente 1.");
			const playerIds: Snowflake[] = [interaction.user.id, opp1.id];
			if (opp2) playerIds.push(opp2.id);

			// validate limits
			if (
				(strat.limits.exact && !strat.limits.exact.includes(playerIds.length)) ||
				playerIds.length < strat.limits.min ||
				(strat.limits.max && playerIds.length > strat.limits.max)
			)
				return replyError(interaction, "Cantidad de jugadores no permitida para este juego.");

			const comandos = (await getChannel(interaction, "casinoPye", true)) as TextChannel;
			if (!comandos) return replyError(interaction, "No encuentro el canal #comandos");

			const thread = await comandos.threads.create({
				name: `${gameName} • ${interaction.user.username}`,
				type: ChannelType.PrivateThread,
				invitable: false,
				autoArchiveDuration: 60,
			});

			// bloquear a todos excepto jugadores
			for (const id of playerIds) {
				await thread.members.add(id).catch(() => {});
			}

			await replyOk(interaction, `Hilo creado: <#${thread.id}>`);

			// runtime boot
			const runtime = new GameRuntime(
				interaction,
				thread,
				playerIds.map((id) => ({ id, hand: [] })),
				strat
			);

			await strat.init(runtime);

			// collectors
			const collector = thread.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 120_000 });
			collector.on("collect", async (i) => {
				if (i.customId === "show-hand") {
					const player = runtime.players.find((p) => p.id === i.user.id);
					if (!player) return i.reply({ content: "No formas parte de esta partida.", ephemeral: true });
					return i.reply({ content: renderCardsAnsi(player.hand, strat.cardSet), ephemeral: true });
				}

				if (i.user.id !== runtime.current.id) {
					await i.reply({ content: "⏳ No es tu turno; esperá.", ephemeral: true });
					setTimeout(() => i.deleteReply().catch(() => {}), 3_000);
					return;
				}

				await strat.handleAction(runtime, i.user.id, i);
				await i.deferUpdate();
			});
			collector.on("end", (_collected, reason) => {
				if (reason === "idle") {
					runtime.finish();
				}
			});
		}
	),
};
