import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelType, ComponentType, User } from "discord.js";
import { getChannel, getChannelFromEnv } from "../../utils/constants.js";
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
import { GameRuntime, PlayerState } from "../../utils/card-games/GameRuntime.js";
import UnoStrategy from "../../utils/card-games/UnoStrategy.js";
import { Users } from "../../Models/User.js";

export const games: GameStrategy[] = [new WarStrategy(), new UnoStrategy()];
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
				)
		)
		.addIntegerOption((opt) => opt.setName("apuesta").setDescription("Apuesta (aplica a todos los jugadores").setRequired(true))
		.addUserOption((opt) => opt.setName("oponente1").setDescription("Primer oponente").setRequired(true))
		.addUserOption((opt) => opt.setName("oponente2").setDescription("Segundo oponente").setRequired(false))
		.addUserOption((opt) => opt.setName("oponente3").setDescription("Segundo oponente").setRequired(false))
		.addUserOption((opt) => opt.setName("oponente4").setDescription("Segundo oponente").setRequired(false))
		.addUserOption((opt) => opt.setName("oponente5").setDescription("Segundo oponente").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), verifyCooldown("card-game", 180000)],
		async function execute(interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> {
			const gameName = interaction.options.getString("juego", true);
			const strat = getGame(gameName);
			if (!strat) return replyError(interaction, "Juego desconocido.");

			const opps = [
				await interaction.options.getUser("oponente1", true),
				await interaction.options.getUser("oponente2", false),
				await interaction.options.getUser("oponente3", false),
				await interaction.options.getUser("oponente4", false),
				await interaction.options.getUser("oponente5", false),
			].filter((u): u is User => !!u);
			if (opps.length === 0) return replyError(interaction, "No se pudo encontrar al oponente 1.");

			const bet = interaction.options.getInteger("apuesta", true);
			if (bet <= 0) return replyError(interaction, "La apuesta debe ser mayor a 0");

			const playerIds = new Set([interaction.user.id, ...opps.map((u) => u.id)]);

			const players = await Users.find({ id: { $in: [...playerIds] } })
				.select({ id: 1, cash: 1 })
				.lean();
			const noCash = players.filter((u) => (u.cash ?? 0) < bet).map((u) => u.id);
			if (noCash.length) return replyError(interaction, `Sin saldo suficiente: ${noCash.map((id) => `<@${id}>`).join(", ")}`);

			if (
				(strat.limits.exact && !strat.limits.exact.includes(playerIds.size)) ||
				playerIds.size < strat.limits.min ||
				(strat.limits.max && playerIds.size > strat.limits.max)
			)
				return replyError(interaction, "Cantidad de jugadores no permitida para este juego.");

			// 1) Marca al creador como aceptado
			const accepted = new Set<string>([interaction.user.id]);

			// 2) Genera botones sólo para los demás jugadores
			const opponentUsers = opps.filter((u) => u.id !== interaction.user.id);

			const acceptButtons = opponentUsers.map((u) =>
				new ButtonBuilder()
					.setCustomId(`accept_${u.id}`)
					.setLabel(u.displayName) // usa displayName directamente
					.setStyle(ButtonStyle.Secondary)
			);

			const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptButtons);

			const msg = await interaction.reply({
				content: `Confirmen para arrancar el VS:`,
				components: [row],
				fetchReply: true,
			});

			const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

			collector.on("collect", async (btn) => {
				const [, uid] = btn.customId.split("_");
				if (btn.user.id !== uid) {
					return btn.reply({ content: "⏳ Ese botón no es para ti.", ephemeral: true });
				}

				if (!accepted.has(uid)) {
					accepted.add(uid);

					// actualiza el botón a verde y deshabilitado
					const newButtons = acceptButtons.map((oldBtn) => {
						const json = oldBtn.toJSON() as any;
						if (json.custom_id === btn.customId) {
							return ButtonBuilder.from(oldBtn).setStyle(ButtonStyle.Success).setDisabled(true);
						}
						return oldBtn;
					});
					await btn.update({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(newButtons)] });

					// si todos aceptaron, lanzamos automáticamente
					if (accepted.size === playerIds.size) {
						collector.stop();
						// — hilo y juego —
						const comandos = (await getChannel(interaction, "casinoPye", true)) as TextChannel;
						const thread = await comandos.threads.create({
							name: `${gameName} • ${interaction.user.username}`,
							type: ChannelType.PrivateThread,
							invitable: false,
							autoArchiveDuration: 60,
						});
						for (const id of playerIds) await thread.members.add(id).catch(() => {});
						await interaction.editReply({ content: `Hilo creado: <#${thread.id}>`, components: [] });

						const allUsers = [interaction.user, ...opps];

						const toRuntime = (u: User, team?: 0 | 1): PlayerState => ({
							id: u.id,
							displayName: u.displayName, // 👈
							hand: [],
							...(team !== undefined && { team }),
						});

						let runtimePlayers: PlayerState[];
						if (strat.teamBased) {
							runtimePlayers = allUsers.map((u, i) => toRuntime(u, i % 2 === 0 ? 0 : 1));
						} else {
							runtimePlayers = allUsers.map((u) => toRuntime(u));
						}

						const runtime = new GameRuntime(interaction, thread, runtimePlayers, strat, bet);
						await strat.init(runtime);

						const gameCollector = thread.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 120_000 });
						gameCollector.on("collect", async (i) => {
							if (i.customId === "show-hand") {
								const player = runtime.players.find((p) => p.id === i.user.id);
								if (!player) return i.reply({ content: "No formas parte del juego", flags: 1 << 6 });
								await i.deferReply({ ephemeral: true });

								const btns = strat.playerChoices?.(runtime, i.user.id) ?? [];
								await i.editReply({
									content: renderCardsAnsi(player.hand, strat.cardSet),
									components: btns.length ? btns : [],
								});

								runtime.handInts.set(i.user.id, i);
								return;
							}

							if (i.user.id !== runtime.current.id) {
								await i.reply({ content: "⏳ No es tu turno; esperá.", ephemeral: true });
								setTimeout(() => i.deleteReply().catch(null), 3_000);
								return;
							}

							await strat.handleAction(runtime, i.user.id, i);
						});
						gameCollector.on("end", (_collected, reason) => {
							if (reason === "idle") {
								runtime.finish();
							}
						});
					}
				}
			});
			collector.on("end", async (_collected, reason) => {
				if (reason === "time" && accepted.size < playerIds.size) {
					await msg.edit({
						content: "Tiempo expirado",
						components: [],
					});
				}
			});
		}
	),
};
