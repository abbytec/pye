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
} from "discord.js";
import { ticketOptions } from "./constants/ticketOptions.js";
import { COLORS, getChannel, getChannelFromEnv, getRoleFromEnv } from "./constants.js";
import { ExtendedClient } from "../client.js";
import fs from "fs";
import path from "path";

let lastTicketDate: Date = new Date();

export async function handleTicketCreation(interaction: Interaction, ticketType: string, reason: string) {
	if (!interaction.guild || !interaction.isRepliable()) return;
	const guild = interaction.guild;
	const member = interaction.member as GuildMember;

	const ticketKey = `${ticketType}-${member.user.username}`;

	if (lastTicketDate.getTime() + 1000 * 10 < Date.now()) {
		lastTicketDate = new Date();
	} else {
		return interaction
			.reply({
				content: "Se han creado otros tickets muy recientemente. Por favor, espera unos segundos.",
				ephemeral: true,
			})
			.then((msg) => {
				setTimeout(() => {
					msg.delete().catch(() => null);
				}, 8000);
			});
	}

	if (ExtendedClient.openTickets.has(ticketKey)) {
		return interaction.reply({ content: `Ya tienes un ticket de ${ticketType} abierto.`, ephemeral: true }).then((msg) => {
			setTimeout(() => {
				msg.delete().catch(() => null);
			}, 8000);
		});
	}

	// Busca la configuración del ticket según el tipo seleccionado
	const option = ticketOptions.find((opt) => opt.type === ticketType);
	if (!option) return interaction.reply({ content: "Tipo de ticket no válido.", ephemeral: true });

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

	const embedReason = new EmbedBuilder()
		.setTitle("Razón del Ticket")
		.setDescription(`Ticket abierto por ${member}:\n${reason}`)
		.setColor(COLORS.warnOrange)
		.setTimestamp();

	const closeButton = new ButtonBuilder().setCustomId("close_ticket").setLabel("Cerrar Ticket").setStyle(ButtonStyle.Danger);

	const escalateButton = new ButtonBuilder().setCustomId("escalate_ticket").setLabel("Elevar Ticket").setStyle(ButtonStyle.Primary);

	const row = { type: 1, components: [closeButton, escalateButton] };

	await ticketChannel.send({
		content: `<@&${getRoleFromEnv("staff")}>, <@&${getRoleFromEnv("moderadorChats")}>`,
		embeds: [embedTicket, embedReason],
		components: [row],
	});
	ExtendedClient.openTickets.add(ticketKey);
	await interaction.reply({ content: `Ticket creado: ${ticketChannel}`, ephemeral: true });
	await logTicketEvent(guild, "CREADO", member.user, ticketChannel, ticketType);
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
		channel.permissionOverwrites.cache.forEach(async (overwrite) => {
			if (overwrite.type === 1) {
				await channel.permissionOverwrites.edit(overwrite.id, {
					ViewChannel: false,
					SendMessages: false,
					ReadMessageHistory: false,
				});
			}
		});
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
	} else if (action === "escalate") {
		// Eleva el ticket: solo rol staff lo verá
		await interaction.channel.permissionOverwrites.edit(getRoleFromEnv("moderadorChats"), {
			ViewChannel: false,
			SendMessages: false,
			ReadMessageHistory: false,
		});
		await interaction.reply({ content: "Ticket escalado a Staff.", ephemeral: true });
	} else if (action === "save") {
		try {
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
						.catch(() => null);
					fs.unlinkSync(filePath);
					setTimeout(() => channel.delete().catch(() => null), 5000);
				}
			);
		} catch (error) {
			console.error("Error al guardar la transcripción:", error);
			await interaction.reply({
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
	}
}

// Función auxiliar para obtener TODOS los mensajes del canal
async function fetchAllMessages(channel: TextChannel) {
	let allMessages = await channel.messages.fetch({ limit: 100 });
	let lastId = allMessages.last()?.id;
	while (lastId) {
		const options: { limit: number; before?: string } = { limit: 100 };
		options.before = lastId;
		const messages = await channel.messages.fetch(options);
		if (messages.size === 0) break;
		allMessages = allMessages.concat(messages);
		lastId = messages.last()?.id;
	}
	return allMessages;
}

// Función para generar la transcripción en HTML y guardarla en un archivo temporal
async function saveTranscript(channel: TextChannel): Promise<string> {
	const transcriptsDir = path.resolve(process.cwd(), "transcripts");
	if (!fs.existsSync(transcriptsDir)) {
		fs.mkdirSync(transcriptsDir, { recursive: true });
	}

	const messages = await fetchAllMessages(channel);
	const sortedMessages = messages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

	let htmlContent = `
  <html>
    <head>
      <meta charset="UTF-8">
      <title>Transcripción del Ticket</title>
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
        .message { margin-bottom: 10px; padding: 10px; background: #fff; border-radius: 5px; }
        .author { font-weight: bold; }
        .time { color: #555; font-size: 0.85em; }
      </style>
    </head>
    <body>
      <h1>Transcripción del Ticket</h1>
  `;

	sortedMessages.forEach((msg) => {
		const time = new Date(msg.createdTimestamp).toLocaleString();
		const content = msg.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
		htmlContent += `
      <div class="message">
        <div class="author">${msg.author.tag} <span class="time">[${time}]</span></div>
        <div class="content">${content}</div>
      </div>
    `;
	});

	htmlContent += `
    </body>
  </html>
  `;

	const filePath = path.join(transcriptsDir, `transcript-${channel.id}.html`);
	fs.writeFileSync(filePath, htmlContent, "utf8");
	return filePath;
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
