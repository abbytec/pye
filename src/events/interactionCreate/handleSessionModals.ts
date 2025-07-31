import { Interaction } from "discord.js";
import { createGameSessionModal, handleCreateSessionModal, handleGameSessionPagination } from "../../commands/duos/busco-equipo.js";

export async function handleSessionModals(interaction: Interaction): Promise<boolean> {
    if (interaction.isButton()) {
        const customId = interaction.customId;
        if (customId.startsWith("create_session_button")) {
            const parts = customId.split("/");
            const juego = parts[2];
            const tiempoLimite = parseInt(parts[3], 10);
            if (isNaN(tiempoLimite)) return true;
            const modal = createGameSessionModal(interaction, juego, tiempoLimite);
            await interaction.showModal?.(modal);
            return true;
        }
        if (customId.startsWith("session_pagination")) {
            await handleGameSessionPagination(interaction);
            return true;
        }
    }
    if (interaction.isModalSubmit() && interaction.customId.startsWith("create_session_modal")) {
        await handleCreateSessionModal(interaction);
        return true;
    }
    return false;
}
