import Bottleneck from "bottleneck";
import { ButtonInteraction, Channel, ChatInputCommandInteraction, Guild, Message } from "discord.js";
import loadEnvVariables from "./environment.js";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";

loadEnvVariables();

const CHANNELS = {
	ayuda: "916353103534632964",
	casinoPye: "875535411924062279",
	recursos: "924436818718494740",
	general: "768329192131526686",
	filosofiaPolitica: "847920994156806194",
	memes: "783188322087993346",
	mudae: "875535411924062279",
	ofertasDeEmpleos: "793661563705360394",
	ofreceServicios: "901578179431530496",
	proyectosNoPagos: "785303382314844160",
	openSource: "1249218089430548605",
	reglas: "845314420494434355",
	roles: "999427534670278667",
	chatProgramadores: "807385882868580392",
	sugerencias: "784608909817937920",
	starboard: "930504113718972516",
	retos: "1141493769699606528",
	anuncios: "797974300283240489",
	invitaciones: "1169865263718600704",
	gruposDeEstudio: "1249222442199814257",
	linkedin: "1344535477268774912",

	// foros
	hardware: "1019727139173576814",
	linux: "1019789271386837102",
	go: "1019729125310734366",
	"bases-de-datos": "1019771485948227614",
	redes: "1019773997296123944",
	"seguridad-informática": "1019776581599768719",
	windows: "1019719246655258705",
	electrónica: "1019750681608994825",
	"game-dev": "1019734514202857592",
	"ayuda-general": "1019686175490986124",
	javascript: "1122388627557732362",
	rust: "1122399598107967580",
	python: "1122390683106414652",
	"c-sharp-dotnet": "1122397677066395689",
	"c-cpp": "1122396855775539320",
	"html-css": "1122376272450945025",
	c: "1122393447698014271",
	php: "1122391769775079505",
	"java-kotlin": "1122390294973915176",
	matemáticas: "1305675508637499493",
	"física-química": "867526069875507240",
	tickets: "865047053884457012",
	ticketsLogs: "904954213501632542",

	// staff
	notificaciones: "925121655578173440",
	logPuntos: "932871373280395314",
	logs: "1145160830741135470",
	logMessages: "844385486469988404",
	voiceLogs: "952655229944467496",
	bansanciones: "844385995352047646",
	staff: "1289417254894702644",
	moderadores: "1289416349860368425",

	// categorias
	categoryStaff: "837035918187298836",
	categoryComunidad: "781678453309177877",
	categoryForos: "1290372079279145092",
};

export type ChannelKeys = keyof typeof CHANNELS;

const CHANNELS_DEV: Partial<Record<keyof typeof CHANNELS, string>> = {
	recursos: "1296190631269372055",
	general: "1296190631269372046",
	reglas: "1296190630724370503",
	roles: "1296190631026233345",
	filosofiaPolitica: "1296190631269372048",
	chatProgramadores: "1296190631269372047",
	ofreceServicios: "1400004970308309013",
	proyectosNoPagos: "1296190631269372052",
	ofertasDeEmpleos: "1400004970115235939",
	openSource: "1296190631269372053",
	sugerencias: "1296190631026233348",
	casinoPye: "1296190631533608961",
	"html-css": "1300952181171818536",
	starboard: "1296190631026233347",
	tickets: "1296190631026233346",
	ticketsLogs: "1296190632792031232",
	retos: "1309615377235312681",
	anuncios: "1310011599003586600",
	invitaciones: "1296190632317943908",
	memes: "1296190631533608960",
	gruposDeEstudio: "1296190631269372054",

	// staff
	notificaciones: "1296190632317943913",
	logPuntos: "1296190632317943914",
	logMessages: "1296190632020414603",
	bansanciones: "1296190632317943909",
	logs: "1296190632020414594",
	voiceLogs: "1296190632317943912",
	staff: "1296190632020414595",
	moderadores: "1296190632020414596",

	// categorias
	categoryStaff: "1296190631810568283",
	categoryComunidad: "1296190631026233354",
	categoryForos: "1296190631533608965",
};

const isDevelopment = process.env.NODE_ENV === "development";

function getChannelsFromEnv() {
	return isDevelopment ? CHANNELS_DEV : CHANNELS;
}

export const helpForums: (keyof typeof CHANNELS)[] = [
	"hardware",
	"linux",
	"go",
	"bases-de-datos",
	"redes",
	"seguridad-informática",
	"windows",
	"electrónica",
	"game-dev",
	"ayuda-general",
	"javascript",
	"rust",
	"python",
	"c-sharp-dotnet",
	"c-cpp",
	"html-css",
	"php",
	"java-kotlin",
	"matemáticas",
	"física-química",
];

const forumTopicDescriptions: Map<Partial<keyof typeof CHANNELS>, string> = new Map([
	["go", "Go lang"],
	["game-dev", "Desarrollo de juegos"],
	["c-sharp-dotnet", "C# y .NET"],
	["c-cpp", "C y C++"],
	["html-css", "HTML y CSS"],
	["java-kotlin", "Java y/o Kotlin"],
	["física-química", "Física y/o Química"],
]);

let reversedChannels: Record<string, string>;

export function getForumTopic(channelId: string): string {
	if (!reversedChannels) {
		const channels = getChannelsFromEnv();

		// Invertir el mapeo de nombre a ID
		reversedChannels = Object.entries(channels).reduce((acc, [name, id]) => {
			acc[id] = name;
			return acc;
		}, {} as Record<string, string>);
	}

	const channelName = reversedChannels[channelId];

	if (channelName && forumTopicDescriptions.has(channelName as Partial<keyof typeof CHANNELS>))
		return forumTopicDescriptions.get(channelName as Partial<keyof typeof CHANNELS>)!;
	else if (channelName) return channelName.replace(/-/g, " ");
	else return "generico";
}

let forumIds: string[] = [];

export function getHelpForumsIdsFromEnv(filter?: keyof typeof CHANNELS) {
	if (forumIds.length) return forumIds;
	for (const forum of helpForums.filter((f) => !filter || f === filter)) {
		forumIds.push(getChannelFromEnv(forum));
	}
	return forumIds;
}

export function getChannelFromEnv(channel: keyof typeof CHANNELS): string {
	return getChannelsFromEnv()[channel] ?? "";
}

export async function getChannel(
	interaction: ChatInputCommandInteraction | Message | Guild | IPrefixChatInputCommand | ButtonInteraction,
	channel: keyof typeof CHANNELS,
	textBased?: boolean,
	channelId?: string
): Promise<Channel | undefined> {
	const canal = interaction.client.channels.resolve(channelId ?? getChannelFromEnv(channel));
	if (textBased && !canal?.isTextBased() && !(interaction instanceof Guild) && !(interaction instanceof Message)) {
		await interaction.reply({
			content: `No se pudo encontrar el canal de texto ${channel}. Por favor, contacta al administrador.`,
			ephemeral: true,
		});
		return undefined;
	}
	return canal ?? undefined;
}

export const USERS = {
	disboard: "302050872383242240",
	ldarki: "407570755673522176",
	abby: "220683580467052544",
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
	usuarioDelMes: "1169106408856363058",

	// team
	staff: "808889381187485736",
	moderadorChats: "994980515335643267",
	helper: "1289416128652771358",
	moderadorVoz: "1290753880191271007",
	creadorDeRetos: "1281308912414363658",
	instructorDeTaller: "797224613867421701",

	// especiales
	granApostador: "884160604275892234",
	granAportador: "873596856121327626",
	granDebatidor: "873597268819865671",
	especialistaEnMemes: "873596533503848509",
	iqNegativo: "1302062476266967201",
	nitroBooster: "790356204001296394",
	nitroOldBooster: "853401223939751937",
	colaborador: "1360019846850416821",

	// sanciones
	restringido: "984278721055830047",
	restringido_foros: "1385798023485063369",
	silenced: "1307455233814823014",

	// categorías
	perfil: "809176709475074078",
	medallas: "1075876589176361071",
	intereses: "921211374275821629",
	lenguajes: "831737279251742761",
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
	usuarioDelMes: "1296190630724370499",

	// team
	staff: "1296190630724370500",
	moderadorChats: "1296190630724370498",
	helper: "1296190630724370497",
	moderadorVoz: "1296190630724370496",
	creadorDeRetos: "1296190630464065617",
	instructorDeTaller: "1296190630648610819",

	// especiales
	granApostador: "1296190630657134617",
	granAportador: "1296190630657134619",
	granDebatidor: "1296190630657134618",
	especialistaEnMemes: "1296190630657134620",
	iqNegativo: "1307563510716432455",
	nitroBooster: "1296190630665392189",
	nitroOldBooster: "1296190630665392189",
	colaborador: "1360020664303489024",

	// sanciones
	restringido: "1296190630678233109",
	silenced: "1307456987147141231",
	restringido_foros: "",

	// categorías
	perfil: "1296190630631837825",
	medallas: "1296190630665392198",
	intereses: "1296190630539563081",
	lenguajes: "1296190630489362492",
};

export function getRoleFromEnv(role: Roles): string {
	return (isDevelopment ? DEV_ROLES : ROLES)[role] ?? "";
}

export function getRoles(...roles: Roles[]): string[] {
	return roles.map((role) => getRoleFromEnv(role));
}

export function getInitialRoles(customRoleNames: (keyof typeof ROLES)[]): string[] {
	let roles = isDevelopment ? DEV_ROLES : ROLES;
	let roleList = [roles.perfil, roles.medallas, roles.intereses, roles.lenguajes];
	customRoleNames.forEach((roleName) => {
		roleList.push(roles[roleName]);
	});
	return roleList;
}

export function getRepRolesByOrder() {
	let roles = isDevelopment ? DEV_ROLES : ROLES;
	/** if you modify the order it will have impact. */
	return {
		novato: roles.novato,
		iniciante: roles.iniciante,
		regular: roles.regular,
		avanzado: roles.avanzado,
		veterano: roles.veterano,
		sabio: roles.sabio,
		experto: roles.experto,
		adalovelace: roles.adalovelace,
	};
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
	avanzado: 40,
	veterano: 80,
	sabio: 100,
	experto: 150,
	adalovelace: 512,
};

export const COLORS = {
	lightSeaGreen: 0x24b7b7, // disboard
	pyeWelcome: 0x00ae86,
	pyeLightBlue: 0x0099ff,
	okGreen: 0x43b581,
	errRed: 0xef5250,
	warnOrange: 0xffae42,
	nitroBooster: 0xf47fff,
	pyeCutePink: 0xff69b4,
};

export const EMOJIS = {
	thumbsUp: ":thumbsup:",
};

export const DISBOARD_UID = "302050872383242240";
export const VOICEMASTER_UID = "442619973374967809";
// El que pone los roles
export const SLASHBOT_UID = "788814313930096662";
export const YAGPDB_XYZ_UID = "204255221017214977";
export const CIRCLE_UID = "497196352866877441";
export const DYNO_UID = "155149108183695360";
export const MUDAE_UID = "432610292342587392";
export const INVITE_TRACKER_UID = "720351927581278219";
export const NOT_SO_BOT_UID = "439205512425504771";
export const NEKOTINA_UID = "429457053791158281";

export const pyecoin = "<a:PyEcoin:908088648245850142>";

// Bots autorizados a enviar enlaces de discord
export const AUTHORIZED_BOTS = [process.env.CLIENT_ID ?? "", MUDAE_UID, INVITE_TRACKER_UID, NOT_SO_BOT_UID, NEKOTINA_UID];

export const messagesProcessingLimiter = new Bottleneck({
	maxConcurrent: 35, // Máximo de mensajes a procesar en paralelo
	minTime: 10, // Tiempo mínimo entre procesamientos (ms)
});

export const commandProcessingLimiter = new Bottleneck({
	maxConcurrent: 15, // Máximo de comandos en paralelo
	minTime: 2, // Tiempo mínimo entre ejecuciones (ms)
});

export const threadForumProcessingLimiter = new Bottleneck({
	maxConcurrent: 3, // Máximo de posts a procesar en paralelo
	minTime: 20, // Tiempo mínimo entre ejecuciones (ms)
});

export const PREFIX = "!";

export const ANSI_COLOR = {
	BLACK: "\x1b[30m",
	RED: "\x1b[31m",
	GREEN: "\x1b[32m",
	YELLOW: "\x1b[33m",
	BLUE: "\x1b[34m",
	MAGENTA: "\x1b[35m",
	CYAN: "\x1b[36m",
	WHITE: "\x1b[37m",
	GRAY: "\x1b[90m",
	ORANGE: "\x1b[38;5;208m",
	RESET: "\x1b[0m",
};
