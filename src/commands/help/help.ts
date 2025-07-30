// src/commands/General/help.ts

import {
        SlashCommandBuilder,
        EmbedBuilder,
        GuildMember,
        ActionRowBuilder,
        StringSelectMenuBuilder,
        ComponentType,
        MessageActionRowComponentBuilder,
} from "discord.js";

import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { COLORS, getRoles } from "../../utils/constants.js";
import { replyError } from "../../utils/messages/replyError.js";
import { verifyCooldown } from "../../composables/middlewares/verifyCooldown.js";
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
                        const member = interaction.member as GuildMember;

                        const staffStatus = member.roles.cache.some((role) => getRoles("staff", "moderadorChats").includes(role.id));

                        // Agrupar los comandos por grupo
                        const groups: Record<string, Array<{ name: string; description: string }>> = {};

                        CommandService.commands.forEach((command) => {
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

                        if (Object.keys(groups).length === 0) {
                                return replyError(interaction, "No se encontraron comandos para mostrar.");
                        }

                        const selectMenu = new StringSelectMenuBuilder()
                                .setCustomId("help_category")
                                .setPlaceholder("Selecciona una categoría")
                                .addOptions(Object.keys(groups).map((g) => ({ label: g, value: g })));

                        const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

                        const welcomeEmbed = new EmbedBuilder()
                                .setTitle("📜 Ayuda")
                                .setDescription("¡Bienvenido al menú de ayuda! Elige una categoría en el menú desplegable para ver sus comandos.")
                                .setColor(COLORS.pyeLightBlue)
                                .setTimestamp();

                        await replyOk(interaction, [welcomeEmbed], undefined, [row], undefined, undefined, true);

                        const message = await interaction.fetchReply();

                        const collector = message.createMessageComponentCollector<ComponentType.StringSelect>({
                                componentType: ComponentType.StringSelect,
                                time: 120000,
                        });

                        collector.on("collect", async (i) => {
                                if (!i.isStringSelectMenu()) return;
                                if (i.user.id !== interaction.user.id) return await replyError(i, "No puedes interactuar con este menú.");

                                const category = i.values[0];
                                const commands = groups[category];
                                if (!commands) return await replyError(i, "Categoría no encontrada.");

                                const embed = new EmbedBuilder()
                                        .setTitle(`📜 ${category}`)
                                        .setDescription(commands.map((cmd) => `**${cmd.name}**: ${cmd.description}`).join("\n"))
                                        .setColor(COLORS.pyeLightBlue)
                                        .setTimestamp();

                                await i.update({ embeds: [embed], components: [row] });
                        });

                        collector.on("end", async () => {
                                const disabledRow = new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
                                        StringSelectMenuBuilder.from(selectMenu).setDisabled(true)
                                );
                                await interaction.editReply({ components: [disabledRow] }).catch(() => null);
                        });
                }
        ),
} as Command;
