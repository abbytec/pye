import { ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, Events, Interaction } from "discord.js";
import { handleSlashCommands } from "./interactionCreate/handleSlashCommands.js";
import { handleTicketButtons } from "./interactionCreate/handleTicketButtons.js";
import { handleSessionModals } from "./interactionCreate/handleSessionModals.js";
import { handleTicketCreation } from "../utils/ticketManager.js";

export default {
	name: Events.InteractionCreate,
	async execute(interaction: Interaction) {
		if (await handleSlashCommands(interaction)) return;
		if (await handleTicketButtons(interaction)) return;
		if (await handleSessionModals(interaction)) return;

		if (interaction.isStringSelectMenu() && interaction.customId === "ticket_select") {
			const selected = interaction.values[0];
			if (selected === "experto") {
				await handleTicketCreation(interaction, selected, null);
			} else {
				const modal = new ModalBuilder().setCustomId(`ticket_reason_modal-${selected}`).setTitle("Razón del ticket");

				const reasonInput = new TextInputBuilder()
					.setCustomId("ticket_reason_input")
					.setLabel("Especifica la razón del ticket")
					.setStyle(TextInputStyle.Paragraph)
					.setRequired(true);

				const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
				modal.addComponents(actionRow);

				await interaction.showModal(modal);
			}
			return;
		}

		if (interaction.isModalSubmit() && interaction.customId.startsWith("ticket_reason_modal-")) {
			const ticketType = interaction.customId.split("-")[1];
			const reason = interaction.fields.getTextInputValue("ticket_reason_input");
			await handleTicketCreation(interaction, ticketType, reason);
		}
	},
};
