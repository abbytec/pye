import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { replyInfo } from "../../utils/messages/replyInfo.js";
import { replyError } from "../../utils/messages/replyError.js";

export default {
	group: "🎮 - Teams",
	data: new SlashCommandBuilder()
		.setName("grupos-activos")
		.setDescription("Muestra las búsquedas activas para un juego.")
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
		.addStringOption((option) =>
			option.setName("nombre").setDescription("Si elegiste 'Otros', especifica el nombre del juego.").setRequired(false)
		),
	execute: composeMiddlewares([verifyIsGuild(process.env.GUILD_ID ?? "")], async (interaction: IPrefixChatInputCommand) => {
		let juego = interaction.options.getString("juego", true);
		if (juego === "otros") {
			juego = interaction.options.getString("nombre", false) ?? "Otros";
		}

		const now = new Date();
		// Eliminar sesiones expiradas para este juego
		for (const [key, session] of ExtendedClient.lookingForGame.entries()) {
			const remainingTime = Math.ceil((session.expiresAt.getTime() - now.getTime()) / 60000);
			if (remainingTime <= 0) {
				ExtendedClient.lookingForGame.delete(key);
			}
		}

		// Obtener sesiones activas para el juego seleccionado
		const availableSessions = Array.from(ExtendedClient.lookingForGame.values())
			.filter((session) => session.juego === juego)
			.map((session) => {
				const requisitosText = session.limitantes ? ` | Requisitos: ${session.limitantes}` : "";
				const remainingTime = Math.ceil((session.expiresAt.getTime() - now.getTime()) / 60000);
				return `<@${session.creador}> - ${session.descripcion}${requisitosText} (Participantes: ${session.participantes.length}, Tiempo restante: ${remainingTime} min)`;
			});

		if (availableSessions.length > 0) {
			const embed = new EmbedBuilder()
				.setTitle("Sesiones Disponibles")
				.setDescription(availableSessions.join("\n\n"))
				.setFooter({ text: "Para unirte, menciona al creador." });

			await replyInfo(interaction, [embed]);
		} else {
			await replyInfo(interaction, "No hay sesiones activas para este juego.");
		}
	}),
} as any;
