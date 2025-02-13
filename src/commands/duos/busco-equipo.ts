// src/commands/busco-equipo.ts

import {
	SlashCommandBuilder,
	ActionRowBuilder,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	EmbedBuilder,
	ModalSubmitInteraction,
	ButtonInteraction,
	ButtonStyle,
	ButtonBuilder,
} from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { IGameSession } from "../../interfaces/IGameSession.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { replyOk } from "../../utils/messages/replyOk.js";

const SESSIONS_PER_PAGE = 1;

export default {
	group: "🎮 - Teams",
	data: new SlashCommandBuilder()
		.setName("busco-equipo")
		.setDescription("Busca un compañero o grupo para jugar.")
		.addStringOption((option) =>
			option
				.setName("juego")
				.setDescription("Selecciona el juego.")
				.setRequired(true)
				.addChoices(
					{ name: "Fortnite", value: "fortnite" },
					{ name: "League of Legends", value: "league_of_legends" },
					{ name: "Counter-Strike", value: "counter_strike" },
					{ name: "Minecraft", value: "minecraft" },
					{ name: "Valorant", value: "valorant" },
					{ name: "GTA Online", value: "gta_online" },
					{ name: "Call of Duty", value: "call_of_duty" },
					{ name: "Otros", value: "otros" }
				)
		)
		.addIntegerOption((option) =>
			option
				.setName("tiempo_limite")
				.setDescription("Tiempo límite en minutos (entre 1 y 60).")
				.setRequired(false)
				.setMinValue(1)
				.setMaxValue(60)
		)
		.addStringOption((option) =>
			option.setName("nombre").setDescription("En caso de haber elegido Otros, establece el nombre del juego.").setRequired(false)
		),
	execute: composeMiddlewares([verifyIsGuild(process.env.GUILD_ID ?? "")], async (interaction: IPrefixChatInputCommand) => {
		let juego = interaction.options.getString("juego", true);
		if (juego === "otros") {
			juego = interaction.options.getString("nombre", false)?.replace("/", "_") ?? "Otros";
		}

		const tiempoLimite = interaction.options.getInteger("tiempo_limite") ?? 5;
		const now = new Date();

		// Eliminar sesiones expiradas
		for (const [key, session] of ExtendedClient.lookingForGame.entries()) {
			if (session.juego === juego) {
				const remainingTime = Math.ceil((session.expiresAt.getTime() - now.getTime()) / 60000);
				if (remainingTime <= 0) {
					ExtendedClient.lookingForGame.delete(key);
				}
			}
		}

		// Obtener sesiones disponibles para el juego solicitado
		const availableSessions = Array.from(ExtendedClient.lookingForGame.values())
			.filter((session: IGameSession) => session.juego === juego)
			.map((session: IGameSession) => {
				const requisitosText = session.limitantes ? ` | Requisitos: ${session.limitantes}` : "";
				const remainingTime = Math.ceil((session.expiresAt.getTime() - now.getTime()) / 60000);
				return `<@${session.creador}> - ${session.descripcion}${requisitosText} (Tiempo restante: ${remainingTime} min)`;
			});

		if (availableSessions.length > 0) {
			// Paginación
			const currentPage = 0;
			const totalPages = Math.ceil(availableSessions.length / SESSIONS_PER_PAGE) || 1;
			const pageSessions = availableSessions.slice(currentPage * SESSIONS_PER_PAGE, (currentPage + 1) * SESSIONS_PER_PAGE);

			const embed = new EmbedBuilder()
				.setTitle("Sesiones Disponibles")
				.setDescription(pageSessions.join("\n\n") || "No hay sesiones disponibles.")
				.setFooter({ text: `Página ${currentPage + 1} de ${totalPages}` });

			const components = [];

			// Si hay más de una página, agregar botones de paginación
			if (availableSessions.length > SESSIONS_PER_PAGE) {
				const paginationRow = new ActionRowBuilder<ButtonBuilder>();
				if (currentPage > 0) {
					paginationRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`session_pagination_prev/${interaction.user.id}/${juego}/${tiempoLimite}/${currentPage}`)
							.setLabel("<<")
							.setStyle(ButtonStyle.Primary)
					);
				}
				if (currentPage < totalPages - 1) {
					paginationRow.addComponents(
						new ButtonBuilder()
							.setCustomId(`session_pagination_next/${interaction.user.id}/${juego}/${tiempoLimite}/${currentPage}`)
							.setLabel(">>")
							.setStyle(ButtonStyle.Primary)
					);
				}
				components.push(paginationRow);
			}

			// Botón para crear nueva sesión
			const createSessionButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
				new ButtonBuilder()
					.setCustomId("create_session_button/" + interaction.user.id + "/" + juego + "/" + tiempoLimite)
					.setLabel("Crear Nueva Sesión")
					.setStyle(ButtonStyle.Success)
			);
			components.push(createSessionButton);
			await replyInfo(interaction, [embed], undefined, components);
			return;
		}
		const modal = createGameSessionModal(interaction, juego, tiempoLimite);
		await interaction.showModal?.(modal);
	}),
} as Command;

export function createGameSessionModal(interaction: IPrefixChatInputCommand | ButtonInteraction, juego: string, tiempoLimite: number) {
	const modal = new ModalBuilder()
		.setCustomId(`create_session_modal/${interaction.user.id}/${juego}/${tiempoLimite}`)
		.setTitle("Crear Nueva Sesión");

	const descripcionInput = new TextInputBuilder()
		.setCustomId("descripcion")
		.setLabel("Descripción de la sesión")
		.setStyle(TextInputStyle.Paragraph)
		.setPlaceholder("Ej: Equipo para farmear elo.")
		.setMaxLength(200)
		.setRequired(true);

	const requisitosInput = new TextInputBuilder()
		.setCustomId("requisitos")
		.setLabel("Requisitos (Región - Rango, etc.)")
		.setStyle(TextInputStyle.Short)
		.setPlaceholder("Ej: LAS - Platino")
		.setMaxLength(200)
		.setRequired(false);

	const modalRow1 = new ActionRowBuilder<TextInputBuilder>().addComponents(descripcionInput);
	const modalRow2 = new ActionRowBuilder<TextInputBuilder>().addComponents(requisitosInput);
	modal.addComponents(modalRow1, modalRow2);

	return modal;
}

// ── Handler para el modal de creación de sesión ──
export async function handleCreateSessionModal(interaction: ModalSubmitInteraction) {
	const customId = interaction.customId;
	const parts = customId.split("/");
	if (parts.length < 4) {
		return await replyError(interaction, "Modal inválido.");
	}
	const userIdFromModal = parts[1];
	const juego = parts[2];
	const tiempoLimiteStr = parts[3];
	const tiempoLimite = parseInt(tiempoLimiteStr, 10);
	if (isNaN(tiempoLimite)) {
		return await replyError(interaction, "Tiempo límite inválido.");
	}

	if (interaction.user.id !== userIdFromModal) {
		return await replyError(interaction, "No eres el creador de la sesión.");
	}

	const descripcion = interaction.fields.getTextInputValue("descripcion").replace("/", "_");
	const limitantes = interaction.fields.getTextInputValue("requisitos").replace("/", "_");

	const key = `${juego}-${interaction.user.id}`;
	if (ExtendedClient.lookingForGame.has(key)) {
		return await replyWarning(interaction, "Ya tienes una sesión creada para este juego.");
	}

	const expiresAt = new Date(Date.now() + tiempoLimite * 60000);

	const newSession: IGameSession = {
		juego,
		creador: interaction.user.id,
		descripcion,
		expiresAt,
		limitantes,
	};
	ExtendedClient.lookingForGame.set(key, newSession);

	await replyOk(
		interaction,
		`Has creado una sesión para **${juego}** que expirará en **${tiempoLimite} min**. Esperando a que otros se unan.`
	);
}

// ── Handler para botones de paginación ──
export async function handleGameSessionPagination(interaction: ButtonInteraction) {
	const customId = interaction.customId;
	const parts = customId.split("/");
	if (parts.length < 5) {
		return await replyError(interaction, "Botón de paginación inválido.");
	}

	const direction = parts[0];
	const userIdFromButton = parts[1];
	const juego = parts[2];
	const tiempoLimite = parseInt(parts[3], 10);
	const currentPage = parseInt(parts[4], 10);

	if (interaction.user.id !== userIdFromButton) {
		return await replyError(interaction, "No puedes usar este botón.");
	}

	const now = new Date();
	const availableSessions = Array.from(ExtendedClient.lookingForGame.values())
		.filter((session: IGameSession) => session.juego === juego)
		.map((session: IGameSession) => {
			const requisitosText = session.limitantes ? ` | Requisitos: ${session.limitantes}` : "";
			const remainingTime = Math.ceil((session.expiresAt.getTime() - now.getTime()) / 60000);
			return `<@${session.creador}> - ${session.descripcion}${requisitosText} (Tiempo restante: ${remainingTime} min)`;
		});

	const totalPages = Math.ceil(availableSessions.length / SESSIONS_PER_PAGE) || 1;
	let newPage = currentPage;
	if (direction === "session_pagination_next") {
		newPage = Math.min(currentPage + 1, totalPages - 1);
	} else if (direction === "session_pagination_prev") {
		newPage = Math.max(currentPage - 1, 0);
	}

	const pageSessions = availableSessions.slice(newPage * SESSIONS_PER_PAGE, (newPage + 1) * SESSIONS_PER_PAGE);

	const embed = new EmbedBuilder()
		.setTitle("Sesiones Disponibles")
		.setDescription(pageSessions.join("\n\n") || "No hay sesiones disponibles.")
		.setFooter({ text: `Página ${newPage + 1} de ${totalPages}` });

	const components = [];

	if (availableSessions.length > SESSIONS_PER_PAGE) {
		const paginationRow = new ActionRowBuilder<ButtonBuilder>();
		if (newPage > 0) {
			paginationRow.addComponents(
				new ButtonBuilder()
					.setCustomId(`session_pagination_prev/${interaction.user.id}/${juego}/${tiempoLimite}/${newPage}`)
					.setLabel("<<")
					.setStyle(ButtonStyle.Primary)
			);
		}
		if (newPage < totalPages - 1) {
			paginationRow.addComponents(
				new ButtonBuilder()
					.setCustomId(`session_pagination_next/${interaction.user.id}/${juego}/${tiempoLimite}/${newPage}`)
					.setLabel(">>")
					.setStyle(ButtonStyle.Primary)
			);
		}
		components.push(paginationRow);
	}

	const createSessionButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId("create_session_button/" + interaction.user.id + "/" + juego + "/" + tiempoLimite)
			.setLabel("Crear Nueva Sesión")
			.setStyle(ButtonStyle.Success)
	);
	components.push(createSessionButton);

	await interaction.update({ embeds: [embed], components });
}
