// middlewares/updateRepRoles.ts
import { Finalware } from "../../types/middleware.ts";
import { GuildMember } from "discord.js";
import { getRoleFromEnv, ROLES_REP_RANGE } from "../constants.ts";

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

	await updateMemberReputationRoles(guildMember, points);
};

export async function updateMemberReputationRoles(member: GuildMember, points: number): Promise<void> {
	// Definimos los roles y sus puntos mínimos, ordenados de mayor a menor
	const rolesWithPoints = Object.entries(ROLES_REP_RANGE).map(([roleName, minPoints]) => ({
		id: getRoleFromEnv(roleName as keyof typeof ROLES_REP_RANGE),
		minPoints,
	}));

	// Determinamos el rol más alto que el miembro debe tener
	let newRoleId: string | null = null;

	for (const role of rolesWithPoints) {
		if (points >= role.minPoints) newRoleId = role.id;
	}

	// Eliminamos todos los roles de reputación actuales
	const rolesToRemove = rolesWithPoints.map((role) => role.id).filter((roleId) => member.roles.cache.has(roleId));

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
}
