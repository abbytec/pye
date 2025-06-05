// middlewares/updateRepRoles.ts
import { Finalware } from "../../types/middleware.js";
import { AttachmentBuilder, GuildMember, TextChannel } from "discord.js";
import { getChannelFromEnv, getRepRolesByOrder, getRoleFromEnv, getRoleName, ROLES_REP_RANGE } from "../constants.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { ExtendedClient } from "../../client.js";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import cardRoles from "../constants/card-roles.js";
import { AutoRoleService } from "../../core/AutoRoleService.js";
const __dirname = dirname(fileURLToPath(import.meta.url));

export const updateRepRoles: Finalware = async (postHandleableInteraction, result) => {
	// Aseguramos que interaction tenga el tipo PostHandleable

	const { helperPoint, guildMember } = result;

	if (!helperPoint) return console.warn("No se encontró helperPoint en la interacción.");

	if (!guildMember) return console.warn("No se encontró member en la interacción.");

	const points = helperPoint.points;

	await updateMemberReputationRoles(guildMember, points, postHandleableInteraction.client);
};

export async function updateMemberReputationRoles(member: GuildMember, points: number, client: ExtendedClient): Promise<void> {
	member = await member.guild.members.fetch({ user: member.user.id, force: true });
	// Definimos los roles y sus puntos mínimos, ordenados de mayor a menor
	const rolesWithPoints = Object.entries(ROLES_REP_RANGE).map(([roleName, minPoints]) => ({
		id: getRoleFromEnv(roleName as keyof typeof ROLES_REP_RANGE),
		minPoints,
	}));

	// Determinamos el rol más alto que el miembro debe tener
	let maxRoleId: string | null = null;
	let maxRoleMinPoints = 0;
	const lastAdaLovelaceTop10 = AutoRoleService.adaLovelaceTop10Id;
	const adaLovelaceId = getRepRolesByOrder().adalovelace;

	if (points >= AutoRoleService.adaLovelaceReps) {
		if (member.roles.cache.has(adaLovelaceId)) return;
		else {
			maxRoleId = adaLovelaceId;
			maxRoleMinPoints = ROLES_REP_RANGE.adalovelace;
		}
	} else {
		for (const role of rolesWithPoints) {
			if ((points >= role.minPoints || member.roles.cache.has(role.id)) && maxRoleMinPoints < role.minPoints) {
				maxRoleId = role.id;
				maxRoleMinPoints = role.minPoints;
			}
		}
	}

	// Eliminamos todos los roles de reputación actuales
	const rolesToRemove = rolesWithPoints
		.filter((role) => {
			return member.roles.cache.has(role.id) && maxRoleId !== role.id;
		})
		.map((role) => role.id);

	if (rolesToRemove.length > 0)
		await member.roles.remove(rolesToRemove).catch((error) => console.error(`Error al eliminar roles de ${member.user.tag}:`, error));

	// Añadimos el nuevo rol si es necesario
	if (maxRoleId && !member.roles.cache.has(maxRoleId)) {
		await member.roles.add(maxRoleId).catch((error) => console.error(`Error al añadir el rol ${maxRoleId} a ${member.user.tag}:`, error));
		await sendAnnoucement(member, maxRoleId, client, maxRoleMinPoints >= ROLES_REP_RANGE.veterano);
	}
	if (maxRoleId === adaLovelaceId) await AutoRoleService.updateAdaLovelace();
	if (lastAdaLovelaceTop10 !== AutoRoleService.adaLovelaceTop10Id) {
		client.guilds.cache
			.get(process.env.GUILD_ID ?? "")
			?.members.fetch(lastAdaLovelaceTop10)
			?.then((member) => {
				member.roles
					.remove(adaLovelaceId)
					.then(() => member.roles.add(getRepRolesByOrder().experto))
					.catch(() => null);
			})
			.catch(() => null);
	}
}

const circlePosX = 112; // Coordenada X del centro
const circlePosY = 119; // Coordenada Y del centro
const circleRadius = 59; // Radio del círculo
async function sendAnnoucement(member: GuildMember, roleId: string, client: ExtendedClient, veterano: boolean) {
	const imageName = getRoleName(roleId);
	if (!imageName) return;

	const canvas = createCanvas(720, 240);
	const ctx = canvas.getContext("2d");

	const rankCard = await loadImage(path.join(__dirname, `../../assets/Images/reputationAnnouncement/${imageName}.png`));
	ctx.drawImage(rankCard, 0, 0, canvas.width, canvas.height);

	// Después de dibujar el avatar, agrega algo así:
	ctx.font = "700 22px Poppins";
	ctx.fillStyle = cardRoles[imageName].announcementColor;
	ctx.textAlign = "left";
	ctx.fillText(`¡Felicidades @${member.user.username}!`, 200, 40);

	// Obtené el avatar con la misma resolución
	const avatar = await loadImage(member.user.displayAvatarURL({ extension: "png", forceStatic: true, size: 128 }));

	ctx.beginPath();
	// Usá el radio calculado
	ctx.arc(circlePosX, circlePosY, circleRadius, 0, Math.PI * 2);
	ctx.closePath();
	ctx.clip();

	// Dibujá la imagen centrada, del tamaño indicado
	ctx.drawImage(avatar, circlePosX - circleRadius, circlePosY - circleRadius, circleRadius * 2, circleRadius * 2);

	let channelToSend = veterano ? getChannelFromEnv("chatProgramadores") : getChannelFromEnv("casinoPye");

	let channel = client.channels.resolve(channelToSend) as TextChannel;
	if (!channel) return;

	// prettier-ignore
	const message = `${member.toString()} junta más puntos rep ayudando en los canales. Puedes leer más sobre rangos en <#${getChannelFromEnv("roles")}>`
	return channel.send({
		content: message,
		files: [new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "rep-up.png" })],
	});
}
