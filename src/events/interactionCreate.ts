import {
	ActionRowBuilder,
	APIButtonComponent,
	ButtonBuilder,
	ButtonInteraction,
	ChatInputCommandInteraction,
	ComponentType,
	EmbedBuilder,
	Events,
	Interaction,
	TextChannel,
} from "discord.js";
import { ExtendedClient } from "../client.js";
import { COLORS, getChannelFromEnv, getRoleFromEnv, USERS } from "../utils/constants.js";
import { checkQuestLevel, IQuest } from "../utils/quest.js";
import { HelperPoint } from "../Models/HelperPoint.js";
import { updateMemberReputationRoles } from "../utils/finalwares/updateRepRoles.js";
import Bottleneck from "bottleneck";
import { checkRole } from "../utils/generic.js";
import { Command } from "../types/command.js";
import { chatInputCommandParser } from "../utils/messages/chatInputCommandParser.js";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";
import { createGameSessionModal, handleCreateSessionModal, handleGameSessionPagination } from "../commands/duos/busco-equipo.js";

const limiter = new Bottleneck({
	maxConcurrent: 15, // Máximo de comandos en paralelo
	minTime: 5, // Tiempo mínimo entre ejecuciones (ms)
});

export default {
	name: Events.InteractionCreate,
	async execute(interaction: Interaction) {
		if (interaction.isChatInputCommand()) {
			const command = (interaction.client as ExtendedClient).commands.get(interaction.commandName);

			if (!command) {
				console.error(`No existe un comando llamado ${interaction.commandName}.`);
				return;
			}

			if (command.isAdmin) {
				// Ejecuta comandos de administrador inmediatamente
				executeCommand(interaction, command);
			} else {
				// Ejecuta comandos genéricos a través del limitador
				limiter.schedule(() => executeCommand(interaction, command));
			}
			return;
		}
		if (interaction.inGuild() && interaction.isButton()) {
			let customId = interaction.customId;
			const userId = interaction.user.id;

			if (customId.startsWith("create_session_button")) {
				const parts = customId.split("/");
				const juego = parts[2];
				const tiempoLimiteStr = parts[3];
				const tiempoLimite = parseInt(tiempoLimiteStr, 10);
				if (isNaN(tiempoLimite)) return;
				const modal = createGameSessionModal(interaction, juego, tiempoLimite);
				return interaction.showModal?.(modal);
			} else if (customId.startsWith("session_pagination")) {
				return handleGameSessionPagination(interaction);
			}
			// Boton de cerrar el warn cuando el user no tenía md abierto
			if (customId === "close_warn") return deleteChannel(interaction);
			// Boton de eliminar el mensaje de #puntos
			else if (customId === "cancel-point") return cancelPoint(interaction);
			// Boton de dar puntos en #puntos TODO: sacar el signo de pregunta
			else if (/^(point-)?\d{17,19}$/.test(customId)) {
				if (userId === USERS.maby) {
					await interaction.reply({
						content: "Tranquila, tenés un equipo hermoso que tambien se podría encargar de esto! :D",
						ephemeral: true,
					});
				}
				if (customId.startsWith("point-")) customId = customId.slice(6);
				return helpPoint(interaction, customId);
			}
		}
		if (interaction.isModalSubmit()) {
			if (interaction.customId.startsWith("create_session_modal")) {
				await handleCreateSessionModal(interaction);
			}
		}
	},
};

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

// Función para eliminar el canal
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

// Función para cancelar el punto (eliminar el mensaje)
async function cancelPoint(interaction: ButtonInteraction): Promise<void> {
	await interaction.message
		.fetch()
		.then(async (message) => await message.delete().catch(() => null))
		.then(async () => await interaction.deferUpdate())
		.catch((error) => console.error("Error al eliminar el mensaje:", error));
}

// Función para otorgar un punto de ayuda
const point = 1;
async function helpPoint(interaction: ButtonInteraction, customId: string): Promise<void> {
	try {
		// Obtener el miembro que recibirá el punto
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

		// Buscar o crear el documento de HelperPoint
		let user = await HelperPoint.findOneAndUpdate({ _id: customId }, { $inc: { points: point } }, { new: true, upsert: true }).exec();

		// Responder al usuario que ha otorgado el punto
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

		// Encontrar el campo "PUNTOS OTORGADOS"
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
			const newComponents = (row.components as APIButtonComponent[])
				.map((component) => {
					if (component.type === ComponentType.Button && "customId" in component && component.customId === "point-" + customId) {
						const button = ButtonBuilder.from(component);
						button.setDisabled(true); // Deshabilitar el botón
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

		// Enviar notificación en un canal específico
		const notificationChannel = interaction.client.channels.resolve(getChannelFromEnv("logPuntos")) as TextChannel | null;
		if (notificationChannel) {
			let message = `Se le ha dado +1 rep al usuario: \`${member.user.username}\`\n> *Puntos anteriores: ${
				user.points - point
			}. Puntos actuales: ${user.points}*`;
			await interaction.client.channels
				.fetch(postId)
				.then((channel) => {
					(channel as TextChannel | null)?.send(message + "\n 🎉 Felicitaciones!");
				})
				.catch(() => null);
			message = `**${interaction.user.username}** ` + message.slice(2);
			message += ` (Canal: <#${getChannelFromEnv("notificaciones")}>) - (Razón: <#${postId}>)`;
			interaction.message.embeds.at(0)?.description && (message += `\n${interaction.message.embeds.at(0)?.description}`);
			await notificationChannel.send(message);
		}

		// Verificar quests
		checkQuestLevel({ msg: interaction.message, userId: customId, rep: 1 } as IQuest);
	} catch (error) {
		console.error("Error al otorgar punto de ayuda:", error);
		if (interaction.replied) await interaction.followUp({ content: "Hubo un error al otorgar el punto.", ephemeral: true });
		else await interaction.reply({ content: "Hubo un error al otorgar el punto.", ephemeral: true });
	}
}

// Función para otorgar rol granApostador
async function handleGameCommands(interaction: IPrefixChatInputCommand) {
	const channelId = interaction.channel?.id;
	const client = interaction.client;
	if (channelId !== getChannelFromEnv("casinoPye")) return;

	// Verificar si el comando ejecutado tiene el grupo "juegos"
	const command = client.commands.get(interaction.commandName);
	if (!command?.group) return;
	if (command.group.toLowerCase().includes("juegos")) {
		checkRole(interaction, getRoleFromEnv("granApostador"), 75, "apostador");
	}
}
