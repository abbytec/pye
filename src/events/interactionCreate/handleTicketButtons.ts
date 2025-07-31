import {
    ActionRowBuilder,
    APIButtonComponent,
    ButtonBuilder,
    ButtonInteraction,
    ComponentType,
    EmbedBuilder,
    Interaction,
    Message,
    TextChannel,
    ThreadChannel,
    ChannelType,
} from "discord.js";
import { handleTicketButtonInteraction } from "../../utils/ticketManager.js";
import { HelperPoint } from "../../Models/HelperPoint.js";
import { COLORS, getChannelFromEnv, getRoleFromEnv } from "../../utils/constants.js";
import { updateMemberReputationRoles } from "../../composables/finalwares/updateRepRoles.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { ExtendedClient } from "../../client.js";

export async function handleTicketButtons(interaction: Interaction): Promise<boolean> {
    if (!interaction.inGuild() || !interaction.isButton()) return false;

    const customId = interaction.customId;

    const handlers: Record<string, () => Promise<any>> = {
        close_ticket: () => handleTicketButtonInteraction(interaction, "close"),
        escalate_ticket: () => handleTicketButtonInteraction(interaction, "escalate"),
        save_ticket: () => handleTicketButtonInteraction(interaction, "save"),
        reopen_ticket: () => handleTicketButtonInteraction(interaction, "reopen"),
        finish_enrollments: () => handleFinishEnrollmentsButton(interaction),
        close_warn: () => deleteChannel(interaction),
        "cancel-point": () => cancelPoint(interaction),
    };

    if (handlers[customId]) {
        const result = await handlers[customId]!();
        if (result !== null) return true;
    }

    if (/^(point-)\d{17,19}$/.test(customId)) {
        await helpPoint(interaction, customId.slice(6));
        return true;
    }

    return false;
}

async function deleteChannel(interaction: ButtonInteraction): Promise<void> {
    try {
        await interaction.deferUpdate();
        const channel = interaction.client.channels.resolve(interaction.channelId) as TextChannel | null;
        if (channel?.isTextBased()) {
            await channel.delete();
            console.log(`Canal ${channel.name} eliminado por ${interaction.user.tag}`);
        }
    } catch (error) {
        console.error("Error al eliminar el canal:", error);
    }
}

async function cancelPoint(interaction: ButtonInteraction): Promise<void> {
    await interaction.message
        .fetch()
        .then(async (message) => await message.delete().catch(() => null))
        .then(async () => await interaction.deferUpdate())
        .catch((error) => console.error("Error al eliminar el mensaje:", error));
}

const point = 1;
async function helpPoint(interaction: ButtonInteraction, customId: string): Promise<void> {
    try {
        const member = interaction.guild?.members.cache.get(customId) ?? interaction.guild?.members.resolve(customId);
        if (!member) {
            if (interaction.replied) await interaction.followUp({ content: "Usuario no encontrado.", ephemeral: true });
            else await interaction.reply({ content: "Usuario no encontrado.", ephemeral: true });
            return;
        }
        if (member.id === interaction.user.id) {
            if (interaction.replied) await interaction.followUp({ content: "No puedes dar puntos a ti mismo.", ephemeral: true });
            else await interaction.reply({ content: "No puedes darte puntos a ti mismo.", ephemeral: true });
            return;
        }

        let user = await HelperPoint.findOneAndUpdate({ _id: customId }, { $inc: { points: point } }, { new: true, upsert: true }).exec();

        if (interaction.replied)
            await interaction
                .followUp({ content: `Le has dado un punto al usuario: \`${member.user.username}\``, ephemeral: true })
                .then((msg) => {
                    setTimeout(() => {
                        msg.delete().catch(() => null);
                    }, 8000);
                });
        else
            await interaction
                .reply({
                    content: `Le has dado un punto al usuario: \`${member.user.username}\``,
                    ephemeral: true,
                })
                .then((msg) => {
                    setTimeout(() => {
                        msg.delete().catch(() => null);
                    }, 8000);
                });

        const embed = EmbedBuilder.from(interaction.message.embeds[0]);

        const fieldIndex = embed.data.fields?.findIndex((field) => field.name === "PUNTOS OTORGADOS");

        if (fieldIndex !== undefined && fieldIndex !== -1 && embed.data.fields) {
            const existingField = embed.data.fields[fieldIndex];
            existingField.value += `\n<@${interaction.user.id}> dio 1 punto a <@${member.id}>`;
            embed.data.fields[fieldIndex] = existingField;
        } else {
            embed.addFields({
                name: "PUNTOS OTORGADOS",
                value: `<@${interaction.user.id}> dio 1 punto a <@${member.id}>`,
                inline: false,
            });
        }
        embed.setColor(COLORS.warnOrange);

        const components = interaction.message.components.map((row) => {
            if (!("components" in row)) return row;
            const newComponents = (row.components as APIButtonComponent[])
                .map((component) => {
                    if (component.type === ComponentType.Button && "customId" in component && component.customId === "point-" + customId) {
                        const button = ButtonBuilder.from(component);
                        button.setDisabled(true);
                        return button;
                    } else if (component.type === ComponentType.Button) {
                        return ButtonBuilder.from(component);
                    } else {
                        return component;
                    }
                })
                .filter((component): component is ButtonBuilder => component instanceof ButtonBuilder);
            return new ActionRowBuilder<ButtonBuilder>().addComponents(newComponents);
        });

        await interaction.message.edit({ embeds: [embed], components });
        updateMemberReputationRoles(member, user.points, interaction.client as ExtendedClient);

        const postFieldIndex = embed.data.fields?.findIndex((field) => field.name === "# Canal");
        let postId = "";
        if (postFieldIndex !== undefined && postFieldIndex !== -1 && embed.data.fields) {
            postId = embed.data.fields[postFieldIndex].value.replace("<#", "").replace(">", "");
        }

        const notificationChannel = interaction.client.channels.resolve(getChannelFromEnv("logPuntos")) as TextChannel | null;
        if (notificationChannel) {
            let message = `Se le ha dado +1 rep al usuario: \`${member.user.username}\``;
            const helpchannel = interaction.client.channels.resolve(postId) as TextChannel | null;
            let thankMessageId: string | null = null;
            if (helpchannel?.id === getChannelFromEnv("chatProgramadores")) {
                const thanksFieldIndex = embed.data.fields?.findIndex((field) => field.name === "# Mensaje de agradecimiento");
                if (thanksFieldIndex !== undefined && thanksFieldIndex !== -1 && embed.data.fields) {
                    const regex = /\[.*?\]\(https:\/\/discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)\)/g;
                    const matches = [...embed.data.fields[thanksFieldIndex].value.matchAll(regex)];
                    if (matches) {
                        [, , , thankMessageId] = matches[matches.length - 1];
                        const thanksFieldIndex2 = embed.data.fields?.findIndex((field) => field.name === "# Miembro Ayudado");
                        let userHelpedId: string | null = null;
                        if (thanksFieldIndex2 !== undefined && thanksFieldIndex2 !== -1) {
                            let userString = embed.data.fields[thanksFieldIndex2].value;
                            const userMatch = RegExp(/<@(\d+)>/).exec(userString);
                            userHelpedId = userMatch ? userMatch[1] : null;
                        }
                        let repMessage: Message | null = await helpchannel?.messages.fetch({ limit: 10 }).then(async (messages) => {
                            let repMessageTemp: Message | null = null;
                            for (const msg of messages.values()) {
                                if (msg.reference && msg.author.bot && msg.author.id === process.env.CLIENT_ID) {
                                    await helpchannel.messages
                                        .fetch(msg.reference.messageId ?? "")
                                        .then((msg2) => {
                                            if (msg2.author.id === userHelpedId) {
                                                repMessageTemp = msg;
                                            }
                                        })
                                        .catch(() => null);
                                }
                            }
                            return repMessageTemp;
                        });
                        if (repMessage !== null) {
                            repMessage.edit(repMessage.content + "\n" + message).catch(() => null);
                        } else {
                            await helpchannel?.messages
                                .fetch(thankMessageId)
                                .then(async (msg) => {
                                    await msg?.reply(message).catch(() => null);
                                })
                                .catch(() => null);
                        }
                    }
                }
            } else {
                helpchannel?.send(message + `\n> *Puntos anteriores: ${user.points - point}. Puntos actuales: ${user.points}*\n🎉 Felicitaciones!`).catch(() => null);
            }

            message = `**${interaction.user.username}** ` + message.slice(2);
            message += ` (Canal: <#${getChannelFromEnv("notificaciones")}>) - (Razón: <#${postId}>) \n> *Puntos anteriores: ${user.points - point}. Puntos actuales: ${user.points}*`;
            interaction.message.embeds.at(0)?.description && (message += `\n${interaction.message.embeds.at(0)?.description}`);
            await notificationChannel.send(message);
        }

        checkQuestLevel({ msg: interaction.message, userId: customId, rep: 1 } as IQuest);
    } catch (error) {
        console.error("Error al otorgar punto de ayuda:", error);
        if (interaction.replied) await interaction.followUp({ content: "Hubo un error al otorgar el punto.", ephemeral: true });
        else await interaction.reply({ content: "Hubo un error al otorgar el punto.", ephemeral: true });
    }
}

async function handleFinishEnrollmentsButton(interaction: ButtonInteraction<"cached" | "raw">) {
    const channel = interaction.channel;
    if (!channel || (channel.type !== ChannelType.PublicThread && channel.type !== ChannelType.PrivateThread)) return;
    const thread = channel as ThreadChannel;
    await interaction.deferReply({ ephemeral: true });
    const author = (await thread.fetchStarterMessage())?.author;
    if (!author) {
        await interaction.editReply({ content: "⚠ No se puede verificar al autor original de este hilo" });
        return;
    }
    if (interaction.user.id !== author.id) await interaction.editReply({ content: "❌ Este hilo no te pertenece." });
    else {
        await thread.setLocked(true);
        await thread.setName(`🔒 Finalizado`);
        await thread.send("Esta convocatoria ha sido cerrada por su propietario.");
        await interaction.editReply({ content: "✅ Hilo cerrado y renombrado exitosamente." });
    }
}
