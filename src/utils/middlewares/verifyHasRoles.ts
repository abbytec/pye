// middlewares/verifyHasRoles.ts
import { Middleware } from "../../types/middleware.ts";
import { GuildMemberRoleManager } from "discord.js";
import { getRoles, Roles } from "../constants.ts";

/**
 * Crea un middleware para verificar si el usuario tiene al menos uno de los roles permitidos.
 * @param allowedRoleIds - Array de IDs de roles permitidos.
 * @returns Middleware.
 */
const verifyHasRolesInternal = (allowedRoleIds: string[]): Middleware => {
	return async (interaction, next) => {
		const member = interaction.member;

		// Verificar que el miembro y sus roles existen
		if (!member || !("roles" in member)) {
			await interaction.reply({
				content: "No se pudo verificar tus roles.",
				ephemeral: true,
			});
			return;
		}

		// Verificar si el miembro tiene alguno de los roles permitidos
		const hasPermission = (member.roles as GuildMemberRoleManager).cache.some((role) => allowedRoleIds.includes(role.id));

		if (!hasPermission) {
			await interaction.reply({
				content: "No tienes permiso para usar este comando.",
				ephemeral: true,
			});
			return;
		}

		await next(); // Continua al siguiente middleware o handler
	};
};

export function verifyHasRoles(...roles: Roles[]): Middleware {
	return verifyHasRolesInternal(getRoles(...roles));
}
