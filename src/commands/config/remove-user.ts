import { SlashCommandBuilder } from "discord.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { HelperPoint } from "../../Models/HelperPoint.js";
import { Users } from "../../Models/User.js";
import redis from "../../redis.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

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
		async (interaction: IPrefixChatInputCommand) => {
			const tipo = interaction.options.getString("tipo", true);
			const usuario = await interaction.options.getUser("usuario", true);
			if (!usuario) return;
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
} as Command;
