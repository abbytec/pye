// helpers/composeMiddlewares.ts
import { Finalware, Middleware, PostHandleable } from "../types/middleware.ts";
import { ChatInputCommandInteraction } from "discord.js";

/**
 * Componer múltiples middlewares en una única función.
 * @param middlewares - Array de middlewares a componer.
 * @param finalHandler - Función que se ejecuta al final de la cadena.
 * @param postHandlers - Array de middlewares a ejecutar después del handler final.
 * @returns Una función que ejecuta los middlewares en orden.
 */
export const composeMiddlewares = (
	middlewares: Middleware[],
	finalHandler: (interaction: ChatInputCommandInteraction) => Promise<void> | void | Promise<any>,
	postHandlers?: Finalware[]
) => {
	return async (interaction: ChatInputCommandInteraction & PostHandleable) => {
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
				let result = (await finalHandler(interaction)) || {};
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
