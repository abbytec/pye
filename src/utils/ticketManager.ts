import {
	ButtonBuilder,
	ButtonStyle,
	GuildMember,
	Interaction,
	EmbedBuilder,
	ChannelType,
	PermissionsBitField,
	TextChannel,
	AttachmentBuilder,
	Guild,
	User,
	Message,
} from "discord.js";
import { ticketOptions } from "./constants/ticketOptions.js";
import { COLORS, getChannelFromEnv, getRoleFromEnv } from "./constants.js";
import { ExtendedClient } from "../client.js";
import fs from "fs";
import { saveTranscript } from "./generic.js";

let lastTicketDate: Date = new Date();

export async function handleTicketCreation(interaction: Interaction, ticketType: string, reason: string | null) {
	if (!interaction.guild || !interaction.isRepliable()) return;
	await interaction.deferReply({ ephemeral: true });
	const guild = interaction.guild;
	const member = interaction.member as GuildMember;

	const ticketKey = `${ticketType}-${member.user.username}`;

	if (lastTicketDate.getTime() + 1000 * 10 < Date.now()) {
		lastTicketDate = new Date();
	} else {
		return interaction
			.editReply({
				content: "Se han creado otros tickets muy recientemente. Por favor, espera unos segundos.",
			})
			.then((msg) => autodeleteMsg(msg));
	}

	if (ExtendedClient.openTickets.has(ticketKey)) {
		return interaction.editReply({ content: `Ya tienes un ticket de ${ticketType} abierto.` }).then((msg) => autodeleteMsg(msg));
	}

	// Busca la configuración del ticket según el tipo seleccionado
	const option = ticketOptions.find((opt) => opt.type === ticketType);
	if (!option) return interaction.editReply({ content: "Tipo de ticket no válido." });

	// Crea el canal del ticket
	const ticketChannel = await guild.channels.create({
		name: ticketKey,
		type: ChannelType.GuildText,
		topic: `${member.user.username} (${member.user.id})`,
		permissionOverwrites: [
			{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
			{
				id: member.id,
				allow: [
					PermissionsBitField.Flags.ViewChannel,
					PermissionsBitField.Flags.SendMessages,
					PermissionsBitField.Flags.ReadMessageHistory,
				],
			},
			{
				id: getRoleFromEnv("staff"),
				allow: [
					PermissionsBitField.Flags.ViewChannel,
					PermissionsBitField.Flags.SendMessages,
					PermissionsBitField.Flags.ReadMessageHistory,
				],
			},
			{
				id: getRoleFromEnv("moderadorChats"),
				allow: [
					PermissionsBitField.Flags.ViewChannel,
					PermissionsBitField.Flags.SendMessages,
					PermissionsBitField.Flags.ReadMessageHistory,
				],
			},
		],
	});

	const embedTicket = new EmbedBuilder(option.embedData).setTimestamp().setFooter({ text: `Creado por ${member.user.tag}` });

	const closeButton = new ButtonBuilder().setCustomId("close_ticket").setLabel("Cerrar Ticket").setStyle(ButtonStyle.Danger);

	const escalateButton = new ButtonBuilder().setCustomId("escalate_ticket").setLabel("Elevar Ticket").setStyle(ButtonStyle.Primary);

	const row = { type: 1, components: [closeButton, escalateButton] };

	let embeds = [embedTicket];

	if (reason) {
		const embedReason = new EmbedBuilder()
			.setTitle("Razón del Ticket")
			.setDescription(`Ticket abierto por ${member}:\n${reason}`)
			.setColor(COLORS.warnOrange)
			.setTimestamp();

		embeds.push(embedReason);
	}

	await ticketChannel.send({
		content: `<@&${getRoleFromEnv("staff")}>, <@&${getRoleFromEnv("moderadorChats")}>, <@${member.id}>`,
		embeds,
		components: [row],
	});
	ExtendedClient.openTickets.add(ticketKey);
	await interaction.editReply({ content: `Ticket creado: ${ticketChannel}` });
	await logTicketEvent(guild, "CREADO", member.user, ticketChannel, ticketType);
}

export function autodeleteMsg(msg: Message) {
	setTimeout(async () => {
		await msg.delete().catch(() => null);
	}, 8000);
}

export async function handleTicketButtonInteraction(interaction: Interaction, action: "close" | "escalate" | "save" | "reopen") {
	if (
		!interaction.guild ||
		!interaction.channel ||
		!interaction.channel.isTextBased() ||
		!("permissionOverwrites" in interaction.channel) ||
		!interaction.isButton()
	)
		return;
	const channel = interaction.channel as TextChannel;
	if (action === "close") {
		// Remueve el acceso del usuario al canal
		let hasBeenClosed = false;
		channel.permissionOverwrites.cache.forEach(async (overwrite) => {
			if (overwrite.type === 1) {
				const deniedView = overwrite.deny.has("ViewChannel");
				const deniedSend = overwrite.deny.has("SendMessages");
				const deniedHistory = overwrite.deny.has("ReadMessageHistory");

				if (deniedView && deniedSend && deniedHistory) {
					hasBeenClosed = true;
				} else {
					await channel.permissionOverwrites.edit(overwrite.id, {
						ViewChannel: false,
						SendMessages: false,
						ReadMessageHistory: false,
					});
				}
			}
		});
		if (hasBeenClosed) return;
		// Embed para opciones de transcripción o reapertura
		const embed = new EmbedBuilder()
			.setTitle("Ticket Cerrado")
			.setDescription("El ticket ha sido cerrado. Puedes guardar la transcripción o reabrir el ticket.")
			.setColor(0xffa500)
			.setTimestamp();

		const saveButton = new ButtonBuilder().setCustomId("save_ticket").setLabel("Guardar").setStyle(ButtonStyle.Primary);

		const reopenButton = new ButtonBuilder().setCustomId("reopen_ticket").setLabel("Reabrir").setStyle(ButtonStyle.Secondary);

		const row = { type: 1, components: [saveButton, reopenButton] };

		await channel.send({ embeds: [embed], components: [row] });
		await interaction.reply({ content: "Ticket cerrado.", ephemeral: true });
		await logTicketEvent(interaction.guild, "CERRADO", interaction.user, interaction.channel as TextChannel, channel.name.split("-")[0]);
		ExtendedClient.openTickets.delete(channel.name);
	} else if (action === "escalate") {
		// Eleva el ticket: solo rol staff lo verá
		const closeButton = new ButtonBuilder().setCustomId("close_ticket").setLabel("Cerrar Ticket").setStyle(ButtonStyle.Danger);
		const escalateButton = new ButtonBuilder()
			.setCustomId("escalate_ticket")
			.setLabel("Elevar Ticket")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(true);
		const firstMessageRow = { type: 1, components: [closeButton, escalateButton] };
		await interaction.update({ components: [firstMessageRow] });
		await interaction.followUp({ content: "Escalando el ticket al Staff.", ephemeral: true });
		setTimeout(async () => {
			await (interaction.channel as TextChannel)?.permissionOverwrites
				.edit(getRoleFromEnv("moderadorChats"), {
					ViewChannel: false,
					SendMessages: false,
					ReadMessageHistory: false,
				})
				.catch(() => null);
		}, 5000);
	} else if (action === "save") {
		try {
			const saveBtn = new ButtonBuilder().setCustomId("save_ticket").setLabel("Guardar").setStyle(ButtonStyle.Primary).setDisabled(true);
			const reopenBtn = new ButtonBuilder().setCustomId("reopen_ticket").setLabel("Reabrir").setStyle(ButtonStyle.Secondary);
			const row = { type: 1, components: [saveBtn, reopenBtn] };
			await interaction.message.edit({ components: [row] });
			const filePath = await saveTranscript(channel);
			if (!fs.existsSync(filePath)) {
				throw new Error("Archivo no encontrado");
			}
			const attachment = new AttachmentBuilder(filePath);
			await logTicketEvent(interaction.guild, "TRANSCRIPCION", interaction.user, channel, channel.name.split("-")[0], attachment).then(
				async () => {
					await interaction
						.reply({
							content: "Transcripción guardada y enviada. Borrando el canal en 5 segundos.",
							ephemeral: true,
						})
						.catch(() => null)
						.finally(() => fs.unlinkSync(filePath));
					setTimeout(() => channel.delete().catch(() => null), 5000);
				}
			);
		} catch (error: any) {
			ExtendedClient.logError("Error al guardar la transcripción:", error.stack, interaction.user.id);
			await interaction.followUp({
				content: "Error al guardar la transcripción.",
				ephemeral: true,
			});
		}
	} else if (action === "reopen") {
		channel.permissionOverwrites.cache.forEach(async (overwrite) => {
			if (overwrite.type === 1) {
				await channel.permissionOverwrites.edit(overwrite.id, {
					ViewChannel: true,
					SendMessages: true,
					ReadMessageHistory: true,
				});
			}
		});
		await interaction.reply({ content: "Ticket reabierto.", ephemeral: true });
		ExtendedClient.openTickets.add(channel.name);
	}
}

export type TicketLogType = "CREADO" | "CERRADO" | "TRANSCRIPCION";

export async function logTicketEvent(
	guild: Guild,
	eventType: TicketLogType,
	user: User,
	ticketChannel: TextChannel,
	ticketType?: string,
	transcript?: AttachmentBuilder
) {
	const logsChannel = guild.channels.cache.get(getChannelFromEnv("ticketsLogs")) as TextChannel;
	if (!logsChannel) return;

	let title = "";
	let description = "";
	let color = 0x2f3136;

	switch (eventType) {
		case "CREADO":
			title = "Ticket creado";
			description = `Ticket creado por **${user.username}**`;
			color = COLORS.okGreen;
			break;
		case "CERRADO":
			title = "Ticket cerrado";
			description = `Ticket cerrado por **${user.username}**`;
			color = COLORS.errRed;
			break;
		case "TRANSCRIPCION":
			title = "Transcripción Guardada";
			description = `El usuario **${user.username}** guardó la transcripción del ticket.`;
			color = COLORS.warnOrange;
			break;
	}

	let fields = [];

	if (eventType == "CREADO") {
		fields.push({
			name: "Ticket",
			value: ticketChannel.toString(),
			inline: false,
		});
	}

	fields.push(
		{
			name: "Panel",
			value: ticketType ?? "Desconocido",
			inline: false,
		},
		{
			name: "Propietario",
			value: `${ticketChannel.topic ?? "N/A"}`,
			inline: false,
		}
	);

	const embed = new EmbedBuilder().setTitle(title).setDescription(description).setColor(color).addFields(fields).setTimestamp();

	if (transcript) {
		await logsChannel.send({ embeds: [embed], files: [transcript] });
	} else {
		await logsChannel.send({ embeds: [embed] });
	}
}
