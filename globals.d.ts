// Asegura que este archivo sea tratado como un módulo
export {};

// Importa las interfaces existentes
import { Command as ICommand } from "./src/types/command.js";

declare global {
	// Declara las interfaces en el ámbito global
	interface Command extends ICommand {}
}
