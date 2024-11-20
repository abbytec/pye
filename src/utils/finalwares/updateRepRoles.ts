// middlewares/updateRepRoles.ts
import { Finalware } from "../../types/middleware.ts";
import { AttachmentBuilder, GuildMember, TextChannel } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv, getRoleName, ROLES_REP_RANGE } from "../constants.ts";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { ExtendedClient } from "../../client.ts";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
// Define los IDs de los roles de reputación
const rep = {
	diez: "ROLE_ID_DIEZ",
	veinte: "ROLE_ID_VEINTE",
	cincuenta: "ROLE_ID_CINCUENTA",
	cien: "ROLE_ID_CIEN",
	doscientos: "ROLE_ID_DOSCIENTOS",
	quinientos: "ROLE_ID_QUINIENTOS",
};

export const updateRepRoles: Finalware = async (postHandleableInteraction, result) => {
	// Aseguramos que interaction tenga el tipo PostHandleable

	const { helperPoint, guildMember } = result;

	if (!helperPoint) return console.warn("No se encontró helperPoint en la interacción.");

	if (!guildMember) return console.warn("No se encontró member en la interacción.");

	const points = helperPoint.points;

	await updateMemberReputationRoles(guildMember, points, postHandleableInteraction.client as ExtendedClient);
};

export async function updateMemberReputationRoles(member: GuildMember, points: number, client: ExtendedClient): Promise<void> {
	// Definimos los roles y sus puntos mínimos, ordenados de mayor a menor
	const rolesWithPoints = Object.entries(ROLES_REP_RANGE).map(([roleName, minPoints]) => ({
		id: getRoleFromEnv(roleName as keyof typeof ROLES_REP_RANGE),
		minPoints,
	}));

	// Determinamos el rol más alto que el miembro debe tener
	let newRoleId: string | null = null;
	let actualRoleMinPoints = 0;

	for (const role of rolesWithPoints) {
		if (points >= role.minPoints) {
			newRoleId = role.id;
			actualRoleMinPoints = role.minPoints;
		}
	}

	let maxOldRoleId: string | null = null;
	let maxOldRoleMinPoints = 0;

	// Eliminamos todos los roles de reputación actuales
	const rolesToRemove = rolesWithPoints
		.filter((role) => {
			if (member.roles.cache.has(role.id) && role.minPoints > maxOldRoleMinPoints) {
				maxOldRoleId = role.id;
				maxOldRoleMinPoints = role.minPoints;
				return true;
			}
			return false;
		})
		.map((role) => role.id);

	if (rolesToRemove.length > 0)
		await member.roles
			.remove(rolesToRemove)
			.then(() => console.log(`Roles ${rolesToRemove.join(", ")} eliminados de ${member.user.tag}`))
			.catch((error) => console.error(`Error al eliminar roles de ${member.user.tag}:`, error));

	// Añadimos el nuevo rol si es necesario
	if (newRoleId && !member.roles.cache.has(newRoleId))
		await member.roles
			.add(newRoleId)
			.then(() => console.log(`Rol ${newRoleId} añadido a ${member.user.tag}`))
			.catch((error) => console.error(`Error al añadir el rol ${newRoleId} a ${member.user.tag}:`, error));

	if (maxOldRoleId && newRoleId && maxOldRoleId !== newRoleId) {
		await sendAnnoucement(member, maxOldRoleId, client, actualRoleMinPoints >= ROLES_REP_RANGE.veterano);
	}
}
async function sendAnnoucement(member: GuildMember, roleId: string, client: ExtendedClient, veterano: boolean) {
	const imageName = getRoleName(roleId);
	if (!imageName) return;

	const canvas = createCanvas(1101, 301);
	const ctx = canvas.getContext("2d");

	const rankCard = await loadImage(path.join(__dirname, `../utils/Images/reputationAnnouncement/${imageName}.png`));
	ctx.drawImage(rankCard, 0, 0, canvas.width, canvas.height);

	const avatar = await loadImage(member.user.displayAvatarURL({ extension: "png", forceStatic: true }));

	ctx.beginPath();
	ctx.arc(140, 140, 178 / 2, 0, Math.PI * 2);
	ctx.closePath();
	ctx.clip();
	ctx.drawImage(avatar, 45, 45, 200, 200);

	let channelToSend = veterano ? getChannelFromEnv("casinoPye") : getChannelFromEnv("chatProgramadores");

	let channel = client.channels.resolve(channelToSend) as TextChannel;
	if (!channel) return;

	// prettier-ignore
	const message = `${member.toString()} junta más puntos rep ayudando en los canales. Puedes leer más sobre rangos en <#${getChannelFromEnv("roles")}>`
	return channel.send({
		content: message,
		files: [new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "rep-up.png" })],
	});
}
