import { SlashCommandBuilder } from "discord.js";
import { DateTime } from "luxon";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

const ZONE_CHOICES = [
        { name: "UTC", value: "UTC" },
        { name: "UTC-3 Argentina", value: "UTC-3" },
        { name: "UTC-4 Chile", value: "UTC-4" },
        { name: "UTC-5 Colombia", value: "UTC-5" },
        { name: "UTC-6 México", value: "UTC-6" },
        { name: "UTC+1 España", value: "UTC+1" },
];

const TYPE_CHOICES = [
        { name: "Hora corta (t)", value: "t" },
        { name: "Hora larga (T)", value: "T" },
        { name: "Fecha corta (d)", value: "d" },
        { name: "Fecha larga (D)", value: "D" },
        { name: "Fecha/Hora corta (f)", value: "f" },
        { name: "Fecha/Hora larga (F)", value: "F" },
        { name: "Relativo (R)", value: "R" },
];

export default {
        data: new SlashCommandBuilder()
                .setName("timestamp")
                .setDescription("Genera un timestamp de Discord")
                .addStringOption((option) =>
                        option
                                .setName("fecha")
                                .setDescription("Fecha y hora (YYYY-MM-DD HH:mm)")
                                .setRequired(true)
                )
                .addStringOption((option) =>
                        option
                                .setName("zona")
                                .setDescription("Zona horaria")
                                .setRequired(true)
                                .addChoices(...ZONE_CHOICES)
                )
                .addStringOption((option) =>
                        option
                                .setName("tipo")
                                .setDescription("Formato del timestamp")
                                .setRequired(true)
                                .addChoices(...TYPE_CHOICES)
                ),
        async execute(interaction: IPrefixChatInputCommand) {
                const dateStr = interaction.options.getString("fecha", true);
                const zone = interaction.options.getString("zona", true);
                const type = interaction.options.getString("tipo", true);

                const dt = DateTime.fromFormat(dateStr, "yyyy-MM-dd HH:mm", {
                        zone,
                });

                if (!dt.isValid) {
                        return replyError(
                                interaction,
                                "Fecha inválida. Usa el formato YYYY-MM-DD HH:mm"
                        );
                }

                const timestamp = Math.floor(dt.toSeconds());
                const result = `<t:${timestamp}:${type}>`;

                await replyOk(interaction, result, null, undefined, undefined, undefined, true);
        },
} as Command;
