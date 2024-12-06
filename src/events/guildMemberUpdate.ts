// src/events/guildMemberUpdate.ts

import { AttachmentBuilder, EmbedBuilder, Events, GuildMember, PartialGuildMember, TextChannel } from "discord.js";
import { ExtendedClient } from "../client.js";
import { Evento, EventoConClienteForzado } from "../types/event.js";
import { COLORS, getChannelFromEnv, getInitialRoles, getRoleFromEnv } from "../utils/constants.js";
import generateCanvaBoosterId from "../utils/canvas.js";

// Expresión regular para detectar URLs en el apodo
const urlRegex = /(https?:\/\/[^\s]+)/i;

export default {
	name: Events.GuildMemberUpdate,
	once: false,
	async executeWithClient(client: ExtendedClient, oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
		if (oldMember.user.bot || newMember.user.bot) return;
		// Asegúrate de que oldMember tenga información completa
		if (oldMember.partial) {
			try {
				await oldMember.fetch();
			} catch (error) {
				console.error("Error al obtener información del miembro antiguo:", error);
				return;
			}
		}

		// Gestionar cambios de roles
		handleRoleChanges(oldMember, newMember, client);

		// Gestionar cambios de apodo
		handleNicknameChange(oldMember, newMember);
	},
} as EventoConClienteForzado;

/**
 * Maneja los cambios de roles entre el miembro antiguo y el nuevo.
 * @param oldMember El estado anterior del miembro.
 * @param newMember El estado nuevo del miembro.
 */
async function handleRoleChanges(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember, client: ExtendedClient) {
	const oldRoles = oldMember.roles.cache;
	const newRoles = newMember.roles.cache;

	// Detectar roles añadidos
	const addedRoles = newRoles.filter((role) => !oldRoles.has(role.id));
	// Detectar roles eliminados
	const removedRoles = oldRoles.filter((role) => !newRoles.has(role.id)).map((role) => role.id);

	const initialRoles = getInitialRoles([]);

	removedRoles.forEach(async (element) => {
		if (initialRoles.includes(element)) {
			await newMember.roles.add(element);
		}
	});

	if (addedRoles.has(getRoleFromEnv("nitroBooster"))) {
		const channel = (client.channels.cache.get(getChannelFromEnv("starboard")) ??
			client.channels.resolve(getChannelFromEnv("starboard"))) as TextChannel;
		const embed = new EmbedBuilder()
			.setTitle("🎉 Nuevo PyE-Booster 🎉")
			.setDescription("¡Gracias por apoyar nuestra comunidad! 🦄")
			.addFields(
				{ name: `😎 ${newMember.user.username} ha mejorado el servidor 🚀`, value: "\u200B" },
				{
					name: "Algunas de las ventajas para ti:",
					value: "🔹 Prioridad de voz en los canales.\n🔹 Capacidad de crear hilos.\n🔹 Rol permanente que demuestra tu apoyo.\n🔹 Acceso a las postulaciones de empleo.\n🔹 Atención priorizada en el servidor.\n🔹 ¡Muchas más ventajas que iremos agregando!",
				},
				{ name: "💡 ¿Tienes sugerencias para boosters?", value: `¡Déjalas en <#${getChannelFromEnv("sugerencias")}>!` }
			)
			.setColor(COLORS.nitroBooster)
			.setImage("attachment://booster.png")
			.setFooter({ text: "¡Este lugar del starboard es para ti!" });
		let boosterImg = new AttachmentBuilder(await generateCanvaBoosterId(newMember), { name: "booster.png" });
		channel.send({ content: `<@${newMember.id}>`, embeds: [embed], files: [boosterImg] });
	}
}

/**
 * Maneja los cambios de apodo del miembro, verificando si contiene una URL.
 * @param oldMember El estado anterior del miembro.
 * @param newMember El estado nuevo del miembro.
 */
async function handleNicknameChange(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
	const oldNickname = oldMember.nickname;
	const oldDisplayName = oldMember.user.displayName;
	const newDisplayName = newMember.user.displayName;

	// Verificar si el apodo ha cambiado
	if (oldDisplayName !== newDisplayName) {
		if (urlRegex.test(newDisplayName.toLowerCase())) {
			await newMember
				.setNickname("$." + newMember.user.username, "DisplayName contenía una URL. Apodado automáticamente.")
				.catch((error) => console.error(`No se pudo cambiar el apodo de ${newMember.user.tag}:`, error));
		} else if (oldNickname?.startsWith("$.")) {
			await newMember
				.setNickname(null, "DisplayName anterior contenía una URL y el actual no. Autoapodo restablecido automáticamente.")
				.catch((error) => console.error(`No se pudo cambiar el apodo de ${newMember.user.tag}:`, error));
		}
	}
}
