import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, ChannelType, ComponentType, User, ThreadChannel } from "discord.js";
import { getChannel, getChannelFromEnv } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyError } from "../../utils/messages/replyError.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
import { WarStrategy, UnoStrategy, TrucoStrategy, PokerStrategy } from "../../utils/card-games/strategies/index.js";
import { GameStrategy } from "../../utils/card-games/strategies/IGameStrategy.js";
import { renderCardsAnsi } from "../../utils/card-games/CardRenderUtils.js";
import { GameRuntime, PlayerState } from "../../utils/card-games/GameRuntime.js";
import { Users } from "../../Models/User.js";

export const games: GameStrategy<any>[] = [new WarStrategy(), new UnoStrategy(), new TrucoStrategy(), new PokerStrategy()];
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
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casino")), verifyCooldown("card-game", 180000)],
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

		// Detectar si está jugando contra el bot
		const botId = interaction.client.user?.id;
		const isVsBot = opps.some((u) => u.id === botId);

		const bet = interaction.options.getInteger("apuesta", true);
		if (bet <= 0) return replyError(interaction, "La apuesta debe ser mayor a 0");

		const playerIds = new Set([interaction.user.id, ...opps.map((u) => u.id)]);

		// Si juega contra el bot, no verificar saldo del bot
		const humanPlayerIds = isVsBot ? [...playerIds].filter((id) => id !== botId) : [...playerIds];

		const players = await Users.find({ id: { $in: humanPlayerIds } })
			.select({ id: 1, cash: 1 })
			.lean();
		const noCash = players.filter((u) => (u.cash ?? 0) < bet).map((u) => u.id);
		if (noCash.length) {
			const noCashMentions = noCash.map((id) => `<@${id}>`).join(", ");
			return replyError(interaction, `Sin saldo suficiente: ${noCashMentions}`);
		}

			if (
				(strat.limits.exact && !strat.limits.exact.includes(playerIds.size)) ||
				playerIds.size < strat.limits.min ||
				(strat.limits.max && playerIds.size > strat.limits.max)
			)
				return replyError(interaction, "Cantidad de jugadores no permitida para este juego.");

		// 1) Marca al creador como aceptado
		const accepted = new Set<string>([interaction.user.id]);

		// Si juega contra el bot, aceptar automáticamente
		if (isVsBot && botId) {
			accepted.add(botId);
		}

		// 2) Genera botones sólo para los demás jugadores (excluyendo al bot)
		const opponentUsers = opps.filter((u) => u.id !== interaction.user.id && u.id !== botId);

		const acceptButtons = opponentUsers.map((u) =>
			new ButtonBuilder()
				.setCustomId(`accept_${u.id}`)
				.setLabel(u.displayName) // usa displayName directamente
				.setStyle(ButtonStyle.Secondary)
		);

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(acceptButtons);

		// Función auxiliar para iniciar el juego
		const startGame = async () => {
			const comandos = (await getChannel(interaction, "casino", true)) as TextChannel;

			// Si es vs bot, jugar en el canal público; si no, crear hilo privado
			let thread: ThreadChannel;
			if (isVsBot) {
				// Crear hilo público
				thread = await comandos.threads.create({
					name: `${gameName} • ${interaction.user.username} vs Bot`,
					type: ChannelType.PublicThread,
					autoArchiveDuration: 60,
				});
				await interaction.editReply({ content: `🎮 Partida de **${gameName}** iniciada: <#${thread.id}>`, components: [] });
			} else {
				// Crear hilo privado
				thread = await comandos.threads.create({
					name: `${gameName} • ${interaction.user.username}`,
					type: ChannelType.PrivateThread,
					invitable: false,
					autoArchiveDuration: 60,
				});
				for (const id of playerIds) await thread.members.add(id).catch(() => {});
				await interaction.editReply({ content: `🎮 Partida de **${gameName}** iniciada: <#${thread.id}>`, components: [] });
			}

			const allUsers = [interaction.user, ...opps];

			const toRuntime = (u: User, team?: 0 | 1): PlayerState => ({
				id: u.id,
				displayName: u.displayName,
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

			let botIsPlaying = false;

			// Función auxiliar para ejecutar el turno del bot
			const executeBotTurn = async () => {
				if (botIsPlaying) return;
				if (!strat.botDecision || !botId) return;

				// Verificar si es turno del bot (normal o esperando respuesta)
				const botIdx = runtime.players.findIndex((p) => p.id === botId);
				const isBotTurn = runtime.current.id === botId;
				const isBotResponding = (runtime as any).meta?.waitingResponse && (runtime as any).meta?.pendingRespondent === botIdx;

				if (!isBotTurn && !isBotResponding) return;

				botIsPlaying = true;

				// Pequeño delay para que parezca más natural
				await new Promise((resolve) => setTimeout(resolve, 1500));

				const decision = await strat.botDecision(runtime, botId);
				if (!decision) {
					botIsPlaying = false;
					return;
				}

				// Simular una interacción de botón del bot
				const mockInteraction = {
					customId: decision,
					user: interaction.client.user,
					deferUpdate: async () => {},
					update: async () => {},
					reply: async () => {},
					followUp: async () => {},
					editReply: async () => {},
					deleteReply: async () => {},
				} as any;

				await strat.handleAction(runtime, botId, mockInteraction);

				botIsPlaying = false;

				setTimeout(() => {
					const stillBotTurn = runtime.current.id === botId;
					const stillResponding = (runtime as any).meta?.waitingResponse && (runtime as any).meta?.pendingRespondent === botIdx;
					if ((stillBotTurn || stillResponding) && strat.botDecision) {
						executeBotTurn();
					}
				}, 3000);
			};

		const gameCollector = thread.createMessageComponentCollector({ componentType: ComponentType.Button, idle: 120_000 });
		gameCollector.on("collect", async (i) => {
			try {
				if (i.customId === "show-hand") {
					const player = runtime.players.find((p) => p.id === i.user.id);
					if (!player) return i.reply({ content: "No formas parte del juego", ephemeral: true });

					const btns = strat.playerChoices?.(runtime, i.user.id) ?? [];
					await i.reply({
						content: `**Tus cartas:**\n${renderCardsAnsi(player.hand)}`,
						components: btns.length ? btns : [],
						ephemeral: true,
					});

					runtime.handInts.set(i.user.id, i);
					return;
				}

				// Para el resto de acciones, defer inmediatamente
				if (!i.deferred && !i.replied) {
					await i.deferUpdate().catch(() => {});
				}

				// Permitir respuestas a envites/eventos (botones con prefijo respond_) aunque no sea tu turno
				// La validación de quién puede responder es manejada por la estrategia del juego
				const isResponseAction = i.customId.startsWith("respond_");

				if (!isResponseAction && i.user.id !== runtime.current.id) {
					await i.editReply({ content: "⏳ No es tu turno; esperá." });
					setTimeout(() => i.deleteReply().catch(null), 3_000);
					return;
				}

				await strat.handleAction(runtime, i.user.id, i);

				// Después de cada acción humana, esperar a que se resuelva el estado
				setTimeout(() => executeBotTurn(), 3000);
			} catch (error) {
				// Silenciar errores de interacciones expiradas
				if (error instanceof Error && error.message?.includes("Unknown interaction")) {
					console.warn("Interacción expirada en card-vs:", error.message);
					return;
				}
				console.error("Error en card-vs collector:", error);
			}
		});

		// Collector para StringSelectMenu (ej: tienda de fichas)
		const selectCollector = thread.createMessageComponentCollector({ componentType: ComponentType.StringSelect, idle: 120_000 });
		selectCollector.on("collect", async (i) => {
			try {
				if (!i.deferred && !i.replied) {
					await i.deferUpdate().catch(() => {});
				}

				await strat.handleAction(runtime, i.user.id, i);

				// Después de cada acción humana, esperar a que se resuelva el estado
				setTimeout(() => executeBotTurn(), 3000);
			} catch (error) {
				if (error instanceof Error && error.message?.includes("Unknown interaction")) {
					console.warn("Interacción expirada en select collector:", error.message);
					return;
				}
				console.error("Error en select collector:", error);
			}
		});
			gameCollector.on("end", (_collected, reason) => {
				if (reason === "idle") {
					runtime.finish();
				}
			});

			// Si el bot empieza, ejecutar su turno
			setTimeout(() => executeBotTurn(), 1000);
		};

		const msg = await interaction.reply({
			content: isVsBot ? `¡Juego contra el bot iniciado!` : `Confirmen para arrancar el VS:`,
			components: acceptButtons.length > 0 ? [row] : [],
			fetchReply: true,
		});

		// Si es vs bot y no hay otros jugadores que confirmar, iniciar inmediatamente
		if (isVsBot && acceptButtons.length === 0) {
			await startGame();
			return;
		}

		const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

		collector.on("collect", async (btn) => {
			try {
				// Responder inmediatamente para evitar timeout
				if (!btn.deferred && !btn.replied) {
					await btn.deferUpdate().catch(() => {});
				}

				const [, uid] = btn.customId.split("_");
				if (btn.user.id !== uid) {
					await btn.followUp({ content: "⏳ Ese botón no es para ti.", ephemeral: true }).catch(() => {});
					return;
				}

				if (!accepted.has(uid)) {
					accepted.add(uid);

					// actualiza el botón a verde y deshabilitado
					const newButtons = acceptButtons.map((oldBtn) => {
						const json = oldBtn.toJSON();
						if ("custom_id" in json && json.custom_id === btn.customId) {
							return ButtonBuilder.from(oldBtn).setStyle(ButtonStyle.Success).setDisabled(true);
						}
						return oldBtn;
					});
					await btn.editReply({ components: [new ActionRowBuilder<ButtonBuilder>().addComponents(newButtons)] });

					// si todos aceptaron, lanzamos automáticamente
					if (accepted.size === playerIds.size) {
						collector.stop();
						await startGame();
					}
				}
			} catch (error) {
				// Silenciar errores de interacciones expiradas
				if (error instanceof Error && error.message?.includes("Unknown interaction")) {
					console.warn("Interacción expirada en collector de aceptación:", error.message);
					return;
				}
				console.error("Error en collector de aceptación:", error);
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
