import { ButtonInteraction, EmbedBuilder, Events, Interaction, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { COLORS, getChannelFromEnv, USERS } from "../utils/constants.ts";
import { checkQuestLevel, IQuest } from "../utils/quest.ts";
import { HelperPoint } from "../Models/HelperPoint.ts";
import { updateMemberReputationRoles } from "../utils/finalwares/updateRepRoles.ts";

export default {
	name: Events.InteractionCreate,
	async execute(interaction: Interaction) {
		// Verifica si la interacción es un comando de texto
		if (interaction.isChatInputCommand()) {
			const command = (interaction.client as ExtendedClient).commands.get(interaction.commandName);

			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: "Un error ejecutando este comando!", ephemeral: true });
				} else {
					await interaction.reply({ content: "There was an error while executing this command!", ephemeral: true });
				}
			}
			return;
		}
		if (interaction.inGuild() && interaction.isButton()) {
			const customId = interaction.customId;
			const userId = interaction.user.id;

			// Boton de cerrar el warn cuando el user no tenía md abierto
			if (customId === "close_warn") return deleteChannel(interaction);

			// Boton de eliminar el mensaje de #puntos
			if (customId === "cancel-point") return cancelPoint(interaction);

			// Boton de dar puntos en #puntos
			if (/^\d{17,19}$/.test(customId)) {
				if (userId === USERS.maby) {
					await interaction.reply({
						content:
							"No vas a dar puntos hoy mi reina <a:JigglerLove:994460658089328710>\nSi ves esto te amo mucho ♥, *No te enojes :c*",
						ephemeral: true,
					});
					return;
				}
				return helpPoint(interaction);
			}
		}
	},
};

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
	try {
		const message = await interaction.message.fetch();
		await message.delete();
		await interaction.deferUpdate();
	} catch (error) {
		console.error("Error al eliminar el mensaje:", error);
	}
}

// Función para otorgar un punto de ayuda
async function helpPoint(interaction: ButtonInteraction): Promise<void> {
	try {
		// Obtener el miembro que recibirá el punto
		const member = interaction.guild?.members.cache.get(interaction.customId);
		if (!member) {
			await interaction.reply({ content: "Usuario no encontrado.", ephemeral: true });
			return;
		}

		// Responder al usuario que ha otorgado el punto
		await interaction.reply({
			content: `Le has dado un punto al usuario: \`${member.user.username}\``,
			ephemeral: true,
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
		await interaction.message.edit({ embeds: [embed] });

		// Buscar o crear el documento de HelperPoint
		let user = await HelperPoint.findOneAndUpdate({ _id: interaction.customId }, { $inc: { points: 1 } }, { new: true, upsert: true });

		updateMemberReputationRoles(member, user.points, interaction.client as ExtendedClient);

		// Enviar notificación en un canal específico
		const notificationChannel = interaction.client.channels.resolve(getChannelFromEnv("logPuntos")) as TextChannel | null;
		if (notificationChannel) {
			await notificationChannel.send(`**${interaction.user.username}** le ha dado un rep al usuario: \`${member.user.username}\``);
		}

		// Verificar quests
		checkQuestLevel({ userId: interaction.customId, rep: 1 } as IQuest);

		// Avisarle con un puntito a maby que se le dio puntos al user
		if (interaction.user.id === USERS.maby) {
			await interaction.reply({ content: ".", ephemeral: true });
			return;
		}
	} catch (error) {
		console.error("Error al otorgar punto de ayuda:", error);
		await interaction.reply({ content: "Hubo un error al otorgar el punto.", ephemeral: true });
	}
}
