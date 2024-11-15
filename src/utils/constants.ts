import { Channel, ChatInputCommandInteraction, Client, Guild, Message } from "discord.js";
const CHANNELS = {
	ayuda: "916353103534632964",
	bansanciones: "844385995352047646",
	casinoPye: "973425187301261393",
	comparte: "924436818718494740",
	general: "1142244181587263511", // chequear
	filosofiaPolitica: "847920994156806194",
	logPuntos: "932871373280395314",
	memes: "783188322087993346",
	mudae: "875535411924062279",
	ofertasDeEmpleos: "793661563705360394",
	ofreceServicios: "901578179431530496",
	proyectosNoPagos: "785303382314844160",
	puntos: "925121655578173440",
	recursos: "768326411484135425",
	reglas: "845314420494434355",
	roles: "999427534670278667",
	chatProgramadores: "807385882868580392",
	sugerencias: "932011356213899274",
	logs: "1145160830741135470",
};

const CHANNELS_DEV: Partial<Record<keyof typeof CHANNELS, string>> = {
	comparte: "1144149847839084624",
	general: "1296190631269372046",
	chatProgramadores: "1142244181587263511",
	ofreceServicios: "1144133135475425320",
	puntos: "1144159059247898657",
	sugerencias: "1296190631026233348",
	logPuntos: "1296190632317943914",
	bansanciones: "1296190632317943909",
	logs: "1296190632020414594",
	casinoPye: "1296190631533608961",
};

const isDevelopment = process.env.NODE_ENV === "development";

export function getChannelFromEnv(channel: keyof typeof CHANNELS): string {
	return isDevelopment ? CHANNELS_DEV[channel] ?? "" : CHANNELS[channel];
}

export async function getChannel(
	interaction: ChatInputCommandInteraction | Message | Guild,
	channel: keyof typeof CHANNELS,
	textBased?: boolean
): Promise<Channel | undefined> {
	getChannelFromEnv(channel);

	const canal = interaction.client.channels.resolve(getChannelFromEnv(channel));
	if (textBased && !canal?.isTextBased() && !(interaction instanceof Guild)) {
		await interaction.reply({
			content: "No se pudo encontrar el canal de sugerencias. Por favor, contacta al administrador.",
			ephemeral: true,
		});
		return undefined;
	}
	return canal ?? undefined;
}

export const USERS = {
	disboard: "302050872383242240",
	maby: "602240617862660096",
};

const ROLES = {
	// rep
	novato: "780597611496865792",
	iniciante: "806755636288815115",
	avanzado: "780597430861168660",
	regular: "805073774088945725",
	veterano: "1190365465327968256",
	sabio: "769538041084903464",
	experto: "838285410995929119",
	adalovelace: "1190365725865545828",
	alanturing: "1190366029633814570",

	// team
	staff: "808889381187485736",
	moderadorChats: "994980515335643267",
	helper: "1289416128652771358",
	moderadorVoz: "1290753880191271007",
	repatidorDeRep: "966791217520209920",

	// especiales
	granApostador: "884160604275892234",

	// sanciones
	restringido: "984278721055830047",
	muted: "1193708756345827409",
};

export type Roles = keyof typeof ROLES;

const DEV_ROLES: Record<Roles, string> = {
	// rep
	novato: "1296190630678233110",
	iniciante: "1296190630678233111",
	avanzado: "1296190630678233114",
	regular: "1296190630678233112",
	veterano: "1296190630678233115",
	sabio: "1296190630678233117",
	experto: "1296190630686494852",
	adalovelace: "1296190630686494853",
	alanturing: "1296190630686494854",

	// team
	staff: "1296190630724370500",
	moderadorChats: "1296190630724370498",
	helper: "1296190630724370497",
	moderadorVoz: "1296190630724370496",
	repatidorDeRep: "1296190630648610818",

	// especiales
	granApostador: "1296190630657134617",

	// sanciones
	restringido: "1296190630678233109",
	muted: "1296190630678233113",
};

export function getRoleFromEnv(role: Roles): string {
	return (isDevelopment ? DEV_ROLES : ROLES)[role] ?? "";
}

export function getRoles(...roles: Roles[]): string[] {
	return roles.map((role) => getRoleFromEnv(role));
}

export function getRepRolesByOrder(): string[] {
	let roles = isDevelopment ? DEV_ROLES : ROLES;
	/** if you modify the order it will have impact. */
	return [
		roles.novato,
		roles.iniciante,
		roles.regular,
		roles.avanzado,
		roles.veterano,
		roles.sabio,
		roles.experto,
		roles.adalovelace,
		roles.alanturing,
	];
}

export function getRoleName(roleId: string): string {
	const roles = isDevelopment ? DEV_ROLES : ROLES;
	return (Object.keys(roles) as Array<keyof typeof roles>).find((key) => roles[key] === roleId) ?? "";
}

/** Minimum points needed to be X */
export const ROLES_REP_RANGE = {
	novato: 0,
	iniciante: 1,
	regular: 16,
	avanzado: 32,
	veterano: 64,
	sabio: 128,
	experto: 256,
	adalovelace: 512,
	alanturing: 1024,
};

export const COLORS = {
	lightSeaGreen: 0x24b7b7,
	pyeLightBlue: 0x0099ff,
	okGreen: 0x43b581,
	errRed: 0xef5250,
	warnOrange: 0xffae42,
};

const EMOJIS = {
	thumbsUp: ":thumbsup:",
};

export const pyecoin = "<a:pyecoin:911087695864950854>";
