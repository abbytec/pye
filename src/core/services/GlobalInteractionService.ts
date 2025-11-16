import { Events, Interaction, ButtonInteraction, TextChannel, ChannelType, ThreadChannel } from "discord.js";
import { createGameSessionModal, handleCreateSessionModal, handleGameSessionPagination } from "../../commands/duos/busco-equipo.js";
import { ExtendedClient } from "../../client.js";
import { CoreClient } from "../CoreClient.js";
import { IService } from "../IService.js";

export default class GlobalInteractionService implements IService {
	public readonly serviceName = "globalInteraction";
	private readonly fullHandlers = new Map<string, (interaction: Interaction) => Promise<any>>();
	private readonly prefixHandlers: { prefix: string; handler: (interaction: Interaction) => Promise<any> }[] = [];

	constructor(private readonly client: CoreClient) {}

	async start() {
		this.client.on(Events.InteractionCreate, (interaction) => this.dispatch(interaction));
	}

	async firstRun() {
		this.register("finish_enrollments", (i) => handleFinishEnrollmentsButton(i as ButtonInteraction));
		this.register("close_warn", (i) => deleteChannel(i as ButtonInteraction));
		this.registerStartsWith("create_session_button", async (i) => {
			if (!i.isButton()) return;
			const parts = i.customId.split("/");
			const juego = parts[2];
			const tiempoLimite = parseInt(parts[3], 10);
			if (isNaN(tiempoLimite)) return;
			const modal = createGameSessionModal(i, juego, tiempoLimite);
			await i.showModal?.(modal);
		});
		this.registerStartsWith("session_pagination", async (i) => {
			if (!i.isButton()) return;
			await handleGameSessionPagination(i);
		});
		this.registerStartsWith("create_session_modal", async (i) => {
			if (!i.isModalSubmit()) return;
			await handleCreateSessionModal(i);
		});
	}

	public register(customId: string, handler: (interaction: Interaction) => Promise<any>) {
		this.fullHandlers.set(customId, handler);
	}

	public registerStartsWith(prefix: string, handler: (interaction: Interaction) => Promise<any>) {
		this.prefixHandlers.push({ prefix, handler });
	}

	private async dispatch(interaction: Interaction) {
		if (!interaction.isMessageComponent() && !interaction.isModalSubmit()) return;
		const id = interaction.customId;
		const handler = this.fullHandlers.get(id);
		if (handler) {
			await handler(interaction);
			return;
		}
		for (const { prefix, handler: h } of this.prefixHandlers) {
			if (id.startsWith(prefix)) {
				await h(interaction);
				return;
			}
		}
	}
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

async function handleFinishEnrollmentsButton(interaction: ButtonInteraction) {
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
