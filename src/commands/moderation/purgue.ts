import { SlashCommandBuilder, PermissionFlagsBits, TextChannel } from "discord.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
        group: "\u2699\ufe0f - Administraci\u00f3n y Moderaci\u00f3n",
        data: new SlashCommandBuilder()
                .setName("purgue")
                .setDescription("Elimina mensajes recientes.")
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
                .addIntegerOption((opt) =>
                        opt
                                .setName("cantidad")
                                .setDescription("Cantidad de mensajes a eliminar (1-100)")
                                .setRequired(true)
                                .setMinValue(1)
                                .setMaxValue(100)
                )
                .addUserOption((opt) =>
                        opt.setName("usuario").setDescription("Usuario del cual eliminar los mensajes")
                ),
        execute: composeMiddlewares(
                [verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "moderadorChats"), deferInteraction()],
                async (interaction: IPrefixChatInputCommand) => {
                        const amount = interaction.options.getInteger("cantidad", true);
                        const user = await interaction.options.getUser("usuario").catch(() => null);

                        if (!interaction.guild) return;

                        if (user) {
                                let deleted = 0;
                                for (const [, ch] of interaction.guild.channels.cache) {
                                        if (!ch.isTextBased()) continue;
                                        const msgs = await (ch as TextChannel).messages.fetch({ limit: 100 }).catch(() => null);
                                        if (!msgs) continue;
                                        const toRemove = Array.from(msgs.filter((m) => m.author?.id === user.id).values()).slice(0, amount - deleted);
                                        if (toRemove.length)
                                                await (ch as TextChannel).bulkDelete(toRemove, true).catch(() => null);
                                        deleted += toRemove.length;
                                        if (deleted >= amount) break;
                                }
                                return await replyOk(interaction, `Se eliminaron ${deleted} mensajes de ${user.tag}.`, undefined, undefined, undefined, undefined, true);
                        } else {
                                if (!interaction.channel || !interaction.channel.isTextBased())
                                        return await replyError(interaction, "Este comando solo puede usarse en canales de texto.");
                                const ch = interaction.channel as TextChannel;
                                const deleted = await ch.bulkDelete(amount, true).catch(() => null);
                                if (!deleted) return await replyError(interaction, "No se pudieron eliminar los mensajes.");
                                return await replyOk(interaction, `Se eliminaron ${deleted.size} mensajes.`, undefined, undefined, undefined, undefined, true);
                        }
                }
        ),
} as Command;
