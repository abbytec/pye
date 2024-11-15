// src/commands/General/help.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember } from "discord.js";

import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { COLORS, getRoles } from "../../utils/constants.ts";
import { ExtendedClient } from "../../client.ts";

export default {
	data: new SlashCommandBuilder().setName("help").setDescription("Muestra la lista de comandos disponibles agrupados por grupo."),

	group: "General", // Asigna el grupo correspondiente

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const client = interaction.client as ExtendedClient;
			const member = interaction.member as GuildMember;

			const staffStatus = member.roles.cache.some((role) => getRoles("staff", "moderadorChats").includes(role.id));

			// Agrupar los comandos por grupo
			const groups: Record<string, Array<{ name: string; description: string }>> = {};

			client.commands.forEach((command) => {
				// Si el grupo contiene 'admin' y el usuario no es staff, omitir este grupo
				if (command.group) {
					if (command.group.toLowerCase().includes("admin") && !staffStatus) return;

					if (!groups[command.group]) groups[command.group] = [];

					groups[command.group].push({
						name: `/${command.data.name}`,
						description: command.data.description,
					});
				} else {
					if (!groups["😊 - General"]) groups["😊 - General"] = [];
					groups["😊 - General"].push({
						name: `/${command.data.name}`,
						description: command.data.description,
					});
				}
			});

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
};
