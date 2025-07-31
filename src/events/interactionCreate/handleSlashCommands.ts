import {
    ChatInputCommandInteraction,
    Interaction,
} from "discord.js";
import Bottleneck from "bottleneck";
import { chatInputCommandParser } from "../../utils/messages/chatInputCommandParser.js";
import { Command } from "../../types/command.js";
import CommandService from "../../core/services/CommandService.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { checkRole } from "../../utils/generic.js";
import { getRoleFromEnv, getChannelFromEnv } from "../../utils/constants.js";

const limiter = new Bottleneck({
    maxConcurrent: 15,
    minTime: 5,
});

export async function handleSlashCommands(interaction: Interaction): Promise<boolean> {
    if (!interaction.isChatInputCommand()) return false;
    const command = CommandService.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No existe un comando llamado ${interaction.commandName}.`);
        return true;
    }

    if (command.isAdmin) {
        await executeCommand(interaction, command);
    } else {
        await limiter.schedule(() => executeCommand(interaction, command));
    }
    return true;
}

async function executeCommand(interaction: ChatInputCommandInteraction, command: Command) {
    try {
        const parsedInteraction = chatInputCommandParser(interaction);
        await command.execute(parsedInteraction);
        await handleGameCommands(parsedInteraction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: "¡Ocurrió un error al ejecutar este comando!", ephemeral: true });
        } else {
            await interaction.reply({ content: "Hubo un error al ejecutar este comando.", ephemeral: true });
        }
    }
}

async function handleGameCommands(interaction: IPrefixChatInputCommand) {
    const channelId = interaction.channel?.id;
    if (channelId !== getChannelFromEnv("casinoPye")) return;

    const command = CommandService.commands.get(interaction.commandName);
    if (!command?.group) return;
    if (command.group.toLowerCase().includes("juegos")) {
        checkRole(interaction, getRoleFromEnv("granApostador"), 75, "apostador");
    }
}
