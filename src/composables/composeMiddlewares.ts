// helpers/composeMiddlewares.ts
import { Finalware, Middleware, PostHandleable } from "../types/middleware.js";
import { MessageFlags, TextChannel } from "discord.js";
import { getChannelFromEnv } from "../utils/constants.js";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";
import { replyError } from "../utils/messages/replyError.js";

/**
 * Componer múltiples middlewares en una única función.
 * @param middlewares - Array de middlewares a componer.
 * @param finalHandler - Función que se ejecuta al final de la cadena.
 * @param postHandlers - Array de middlewares a ejecutar después del handler final.
 * @returns Una función que ejecuta los middlewares en orden.
 */
export const composeMiddlewares = (
	middlewares: Middleware[],
	finalHandler: (interaction: IPrefixChatInputCommand) => Promise<PostHandleable | void>,
	postHandlers?: Finalware[]
) => {
	return async (interaction: IPrefixChatInputCommand & PostHandleable) => {
		// Índice para rastrear el middleware actual
		let index = -1;

		const dispatch = async (i: number): Promise<void> => {
			if (i <= index) {
				throw new Error("next() llamada múltiples veces");
			}
			index = i;
			const middleware = middlewares[i];
			if (middleware) {
				await middleware(interaction, () => dispatch(i + 1));
			} else {
				// Si no hay más middlewares, llama al handler
				const result =
					(await finalHandler(interaction).catch((e) => {
						if (e instanceof Error && e.name === "ParameterError") {
							replyError(interaction, e.message);
						} else {
							console.error(e);
							(interaction.guild?.channels.resolve(getChannelFromEnv("logs")) as TextChannel).send({
								content: `${
									process.env.NODE_ENV === "development"
										? `<@${interaction.user.id}>`
										: "<@220683580467052544> <@602240617862660096>"
								}Error "${e.name}" en el comando: \`${interaction.commandName}\`\nMensaje: **${(e.message as string).slice(
									0,
									3000
								)}**\n\`\`\`js\n${e.stack}\`\`\``,
								flags: MessageFlags.SuppressNotifications,
							});
						}
					})) ?? {};
				// Después de ejecutar el handler final, ejecutamos los postHandlers si existen
				if (postHandlers) {
					for (const postHandler of postHandlers) {
						await postHandler(interaction, result);
					}
				}
			}
		};

		await dispatch(0);
	};
};
