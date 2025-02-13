import { SlashCommandBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ModalSubmitInteraction } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { IGameSession } from "../../interfaces/IGameSession.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";

export default {
	group: "🎮 - Teams",
	data: new SlashCommandBuilder()
		.setName("crear-grupo")
		.setDescription("Crea un nuevo equipo para jugar.")
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
			option.setName("nombre").setDescription("Si elegiste 'Otros', especifica el nombre del juego.").setRequired(false)
		),
	execute: composeMiddlewares([verifyIsGuild(process.env.GUILD_ID ?? "")], async (interaction: IPrefixChatInputCommand) => {
		let juego = interaction.options.getString("juego", true);
		if (juego === "otros") {
			juego = interaction.options.getString("nombre", false) ?? "Otros";
		}
		const tiempoLimite = interaction.options.getInteger("tiempo_limite") ?? 5;

		const now = new Date();
		// Eliminar sesiones expiradas para este juego
		for (const [key, session] of ExtendedClient.lookingForGame.entries()) {
			if (session.juego === juego) {
				const remainingTime = Math.ceil((session.expiresAt.getTime() - now.getTime()) / 60000);
				if (remainingTime <= 0) {
					ExtendedClient.lookingForGame.delete(key);
				}
			}
		}

		// Crear modal para crear una nueva sesión
		const modal = new ModalBuilder()
			.setCustomId(`create_session_modal/${interaction.user.id}/${juego}/${tiempoLimite}`)
			.setTitle("Crear Nueva Sesión");

		const descripcionInput = new TextInputBuilder()
			.setCustomId("descripcion")
			.setLabel("Descripción de la sesión")
			.setStyle(TextInputStyle.Paragraph)
			.setPlaceholder("Ej: Equipo para farmear elo.")
			.setRequired(true);

		const requisitosInput = new TextInputBuilder()
			.setCustomId("requisitos")
			.setLabel("Requisitos (Región - Rango, etc.)")
			.setStyle(TextInputStyle.Short)
			.setPlaceholder("Ej: LAS - Platino")
			.setRequired(false);

		const modalRow1 = new ActionRowBuilder<TextInputBuilder>().addComponents(descripcionInput);
		const modalRow2 = new ActionRowBuilder<TextInputBuilder>().addComponents(requisitosInput);
		modal.addComponents(modalRow1, modalRow2);

		await interaction.showModal?.(modal);
	}),
} as any;

// ── Handler para el modal de creación de sesión ──
export async function handleCreateSessionModal(interaction: ModalSubmitInteraction) {
	const customId = interaction.customId;
	const parts = customId.split("/");
	if (parts.length < 4) {
		return await replyError(interaction, "Modal inválido.");
	}

	// parts: [ "create_session_modal", userId, juego, tiempoLimite ]
	const userIdFromModal = parts[1];
	const juego = parts[2];
	const tiempoLimiteStr = parts[3];
	const tiempoLimite = parseInt(tiempoLimiteStr, 10);
	if (isNaN(tiempoLimite)) {
		return await replyError(interaction, "Tiempo límite inválido.");
	}

	// Validar que el usuario que envía el modal sea el mismo que inició la creación
	if (interaction.user.id !== userIdFromModal) {
		return await replyError(interaction, "No eres el creador de la sesión.");
	}

	const descripcion = interaction.fields.getTextInputValue("descripcion");
	const limitantes = interaction.fields.getTextInputValue("requisitos");

	// Usar como key el formato: `${juego}-${creador}`
	const key = `${juego}-${interaction.user.id}`;
	if (ExtendedClient.lookingForGame.has(key)) {
		return await replyWarning(interaction, "Ya tienes una sesión creada para este juego.");
	}

	// Crear la fecha de expiración sumándole el tiempo límite en minutos a la fecha actual.
	const expiresAt = new Date(Date.now() + tiempoLimite * 60000);

	const newSession: IGameSession = {
		juego,
		creador: interaction.user.id,
		descripcion,
		participantes: [interaction.user.id],
		expiresAt,
		limitantes,
	};
	ExtendedClient.lookingForGame.set(key, newSession);

	await replyOk(
		interaction,
		`Has creado una sesión para **${juego}** que expirará en **${tiempoLimite} min**. Esperando a que otros se unan.`
	);
}
