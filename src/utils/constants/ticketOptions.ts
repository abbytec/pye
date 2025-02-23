import { COLORS } from "../constants.js";

export interface TicketOption {
	button: string;
	type: string;
	description: string;
	emoji: string;
	embedData: {
		title: string;
		description: string;
		color: number;
	};
}

export const ticketOptions: TicketOption[] = [
	{
		button: "Reportar",
		type: "reporte",
		emoji: "❗",
		description: "Denunciar mal comportamiento de otros usuarios.",
		embedData: {
			title: "Bienvenido a tu ticket",
			description:
				"Por favor ve escribiendo el motivo de tu ticket mientras esperas que un Staff te atienda para poder agilizar tu atención.",
			color: COLORS.pyeLightBlue,
		},
	},
	{
		button: "Aviso Destacado",
		type: "aviso",
		emoji: "📢",
		description: "Compra o consulta por publicidad en del servidor!",
		embedData: {
			title: "Bienvenido a tu ticket",
			description:
				"Puedes publicar lo que quieras en el servidor para publicitar lo que necesites.\nTenemos varios precios y ofertas dependiendo de tu presupuesto.",
			color: COLORS.pyeLightBlue,
		},
	},
	{
		button: "Quiero dar un Taller",
		type: "taller",
		emoji: "🎓",
		description: "Quieres dar un taller en el servidor?",
		embedData: {
			title: "Bienvenido a tu ticket",
			description:
				"Estos tickets son para organizar un taller dentro del servidor, nosotros damos el servidor a disposición del interesado en dar el taller, ayudamos en cuanto a la moderación y a la difusión del mismo.",
			color: COLORS.pyeLightBlue,
		},
	},
	{
		button: "Solicitar alianza de servidor",
		type: "alianza",
		emoji: "🤝",
		description: "Mínimo 300 usuarios y debe cumplir la ToS de Discord.",
		embedData: {
			title: "Bienvenido a tu ticket",
			description:
				"Requisitos de la alianza\n-El servidor debe cumplir las ToS de Discord.\n-Debe ser un servidor libre de NSFW.\n-Mínimo 300 usuarios.\n-Debes publicar la alianza con ping everyone.\n\nSi cumples todo esto confirma respondiendo este ticket",
			color: COLORS.pyeLightBlue,
		},
	},
	{
		button: "General",
		type: "general",
		emoji: "❓",
		description: "Si ninguna de las opciones anteriores aplica.",
		embedData: {
			title: "Bienvenido a tu ticket",
			description:
				"Por favor ve escribiendo el motivo de tu ticket mientras esperas que un Staff te atienda para poder agilizar tu atención.",
			color: COLORS.pyeLightBlue,
		},
	},
];
