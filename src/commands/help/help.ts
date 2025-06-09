// src/commands/General/help.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember } from "discord.js";

import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { COLORS, getRoles } from "../../utils/constants.js";
import { replyError } from "../../utils/messages/replyError.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import CommandService from "../../core/services/CommandService.js";

export default {
	group: "📜 - Ayuda",
	data: new SlashCommandBuilder()
		.setName("help")
		.setDescription("Muestra la lista de comandos disponibles agrupados por grupo.")
		.addStringOption((option) => option.setName("grupo").setDescription("Nombre del grupo para filtrar").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("help", 6e4), deferInteraction()],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const client = interaction.client;
			const member = interaction.member as GuildMember;

			const staffStatus = member.roles.cache.some((role) => getRoles("staff", "moderadorChats").includes(role.id));

			const groupFilter = interaction.options.getString("grupo")?.toLowerCase();

			// Agrupar los comandos por grupo
			const groups: Record<string, Array<{ name: string; description: string }>> = {};

			CommandService.commands.forEach((command) => {
				// Si el grupo contiene 'admin' y el usuario no es staff, omitir este grupo
				if (command.group) {
					if (command.group.toLowerCase().includes("admin") && !staffStatus) return;

					if (groupFilter && !command.group.toLowerCase().includes(groupFilter)) return;

					if (!groups[command.group]) groups[command.group] = [];

					groups[command.group].push({
						name: `/${command.data.name}`,
						description: command.data.description,
					});
				} else {
					if (groupFilter && !"😊 - General".includes(groupFilter)) return;

					if (!groups["😊 - General"]) groups["😊 - General"] = [];
					groups["😊 - General"].push({
						name: `/${command.data.name}`,
						description: command.data.description,
					});
				}
			});

			if (Object.keys(groups).length === 0) {
				return replyError(interaction, "No se encontraron comandos para el grupo especificado.");
			}

			// Crear el embed para listar los comandos
			const embed = new EmbedBuilder()
				.setTitle("📜 Lista de Comandos")
				.setDescription("Aquí tienes una lista de todos los comandos disponibles, agrupados por categoría.")
				.setColor(COLORS.pyeLightBlue)
				.setTimestamp();

			// Añadir cada grupo como un campo en el embed
			for (const [group, commands] of Object.entries(groups)) {
				const commandList = commands.map((cmd) => `**${cmd.name}**: ${cmd.description}`).join("\n");

				embed.addFields({
					name: `**${group.charAt(0).toUpperCase() + group.slice(1)}**`,
					value: commandList,
					inline: false,
				});
			}

			return await replyOk(interaction, [embed], undefined, undefined, undefined, undefined, true);
		}
	),
} as Command;
