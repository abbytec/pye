import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { getRoleFromEnv } from "../../utils/constants.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { HelperPoint } from "../../Models/HelperPoint.ts";
import { Users } from "../../Models/User.ts";
import redis from "../../redis.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";

export default {
	group: "⚙️ - Administración - General",
	data: new SlashCommandBuilder()
		.setName("remove-user")
		.setDescription("Elimina datos de la base de datos de un usuario.")
		.addStringOption((option) =>
			option
				.setName("tipo")
				.setDescription("El tipo de datos a eliminar.")
				.setRequired(true)
				.addChoices({ name: "Rep", value: "rep" }, { name: "Money", value: "money" })
		)
		.addUserOption((option) => option.setName("usuario").setDescription("El usuario cuyos datos se eliminarán.").setRequired(true)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff"), deferInteraction()],
		async (interaction: ChatInputCommandInteraction) => {
			const tipo = interaction.options.getString("tipo", true);
			const usuario = interaction.options.getUser("usuario", true);
			const userId = usuario.id;

			try {
				let data;
				if (tipo === "rep") {
					data = await HelperPoint.findOne({ _id: userId });
					if (!data) {
						return await replyError(interaction, "No se encontraron datos de rep para ese usuario.");
					}
					await data.deleteOne();
				} else if (tipo === "money") {
					data = await Users.findOne({ id: userId });
					if (!data) {
						return await replyError(interaction, "No se encontraron datos de money para ese usuario.");
					}
					await data.deleteOne();
					await redis.sendCommand(["ZREM", "top:all", userId]);
					await redis.sendCommand(["ZREM", "top:cash", userId]);
					await redis.sendCommand(["ZREM", "top:rob", userId]);
				}

				await replyOk(interaction, "Se han eliminado los datos correctamente.");
			} catch (error) {
				console.error("Error procesando el comando remove-user:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}
		}
	),
};
