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
};

const CHANNELS_DEV: Partial<Record<keyof typeof CHANNELS, string>> = {
	comparte: "1144149847839084624",
	general: "1142244181587263511",
	chatProgramadores: "1142244181587263511",
	ofreceServicios: "1144133135475425320",
	puntos: "1144159059247898657",
	sugerencias: "1296190631026233348",
};

export function getChannel(channel: keyof typeof CHANNELS): string {
	if (process.env.NODE_ENV === "development") {
		return CHANNELS_DEV[channel] ?? "";
	} else {
		return CHANNELS[channel];
	}
}

const USERS = {
	disboard: "302050872383242240",
	maby: "602240617862660096",
};

const ROLES = {
	novatos: "780597611496865792",
	iniciante: "806755636288815115",
	avanzado: "780597430861168660",
	regular: "805073774088945725",
	veterano: "1190365465327968256",
	sabio: "769538041084903464",
	experto: "838285410995929119",
	adalovelace: "1190365725865545828",
	alanturing: "1190366029633814570",
	perms: "808889381187485736", //super admin
	repatidorDeRep: "966791217520209920",
	restringido: "984278721055830047",
	staff: "994980515335643267",
	granApostador: "884160604275892234",
	muted: "1193708756345827409",
};

/** if you modify the order it will have impact. */
const REP_ROLES_BY_ORDER = [
	ROLES.novatos,
	ROLES.iniciante,
	ROLES.regular,
	ROLES.avanzado,
	ROLES.veterano,
	ROLES.sabio,
	ROLES.experto,
	ROLES.adalovelace,
	ROLES.alanturing,
];

/** related to reputation and also utils/images/reputation */
const REP_ROLES_IMG_NAMES = {
	[ROLES.novatos]: "novato",
	[ROLES.iniciante]: "iniciante",
	[ROLES.regular]: "regular",
	[ROLES.avanzado]: "avanzado",
	[ROLES.veterano]: "veterano",
	[ROLES.sabio]: "sabio",
	[ROLES.experto]: "experto",
	[ROLES.adalovelace]: "adalovelace",
	[ROLES.alanturing]: "alanturing",
};

/** Minimum points needed to be X */
const ROLES_REP_RANGE = {
	[ROLES.novatos]: 0,
	[ROLES.iniciante]: 1,
	[ROLES.regular]: 16,
	[ROLES.avanzado]: 32,
	[ROLES.veterano]: 64,
	[ROLES.sabio]: 128,
	[ROLES.experto]: 256,
	[ROLES.adalovelace]: 512,
	[ROLES.alanturing]: 1024,
};

const COLORS = {
	lightSeaGreen: 0x24b7b7,
};

const EMOJIS = {
	thumbsUp: ":thumbsup:",
};
