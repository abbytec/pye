// src/commands/General/komi.ts

import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, Guild } from "discord.js";
import Canvas from "@napi-rs/canvas";
import fetch from "node-fetch"; // Asegúrate de tener instalado node-fetch
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS } from "../../utils/constants.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const GITHUB_API_URL = "https://api.github.com";
const REPO_OWNER = "cat-milk";
const REPO_NAME = "Anime-Girls-Holding-Programming-Books";

// Mapeo para opciones que pueden tener diferentes nombres
// Mapeo de alias de opciones a los nombres de directorios correspondientes
const optionAliases: Record<string, string> = {
	// Lenguajes de programación
	"a++": "A++",
	"a+": "A++",
	abap: "ABAP",
	ai: "AI",
	apl: "APL",
	asm: "ASM",
	ada: "Ada",
	agda: "Agda",
	algorithms: "Algorithms",
	algorithm: "Algorithms",
	angular: "Angular",
	architecture: "Architecture",
	beef: "Beef",

	"c#": "C#",
	csharp: "C#",

	"c++": "C++",
	cpp: "C++",

	c: "C",
	cmake: "CMake",
	css: "CSS",
	clojure: "Clojure",
	cobol: "Cobol",
	coffeescript: "CoffeeScript",
	coffee: "CoffeeScript",
	compilers: "Compilers",
	cuda: "Cuda",
	d: "D",
	dart: "Dart",
	delphi: "Delphi",
	"design patterns": "Design Patterns",
	designpatterns: "Design Patterns",
	design_pattern: "Design Patterns",
	editors: "Editors",
	elixir: "Elixir",
	elm: "Elm",

	"f#": "F#",
	fsharp: "F#",

	forth: "FORTH",
	fortran: "Fortran",
	gdscript: "GDScript",
	git: "Git",
	go: "Go",
	godot: "Godot",
	haskell: "Haskell",
	hott: "HoTT",
	holyc: "HolyC",
	idris: "Idris",

	java: "Java",
	javascript: "Javascript",
	js: "Javascript",
	julia: "Julia",
	kotlin: "Kotlin",
	linux: "Linux",
	lisp: "Lisp",
	lua: "Lua",
	math: "Math",
	memes: "Memes",
	mixed: "Mixed",
	mongodb: "MongoDB",
	nim: "Nim",

	nodejs: "NodeJs",
	"node.js": "NodeJs",
	node: "NodeJs",

	ocaml: "OCaml",
	"objective-c": "Objective-C",
	objectivec: "Objective-C",

	orchestrator: "Orchestrator",
	other: "Other",

	php: "PHP",
	perl: "Perl",
	personification: "Personification",

	powershell: "PowerShell",
	ps: "PowerShell",

	prolog: "Prolog",
	purescript: "Purescript",

	python: "Python",
	py: "Python",

	"quantum computing": "Quantum Computing",
	quantum: "Quantum Computing",

	r: "R",
	racket: "Racket",
	raytracing: "RayTracing",
	rect: "ReCT",
	regex: "Regex",

	ruby: "Ruby",
	rust: "Rust",

	sicp: "SICP",
	sql: "SQL",
	scala: "Scala",
	shell: "Shell",
	sh: "Shell",

	smalltalk: "Smalltalk",
	solidity: "Solidity",
	swift: "Swift",

	systems: "Systems",

	typescript: "Typescript",
	ts: "Typescript",

	uefi: "UEFI",
	uncategorized: "Uncategorized",

	unity: "Unity",
	unreal: "Unreal",

	v: "V",
	vhdl: "VHDL",
	verilog: "Verilog",

	"visual basic": "Visual Basic",
	vb: "Visual Basic",
	"vb.net": "Visual Basic",

	vuejs: "VueJS",
	"vue.js": "VueJS",
	vue: "VueJS",

	vulkan: "Vulkan",
	webgl: "WebGL",
};

export default {
	data: new SlashCommandBuilder()
		.setName("komi-book")
		.setDescription("Envía una imagen de komi con texto personalizado o una chica anime con un libro.")
		.addStringOption((option) =>
			option
				.setName("texto")
				.setDescription("Texto u opción predefinida (escribe 'list' para ver los libros disponibles).")
				.setRequired(true)
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const textoInput = interaction.options.getString("texto", true)?.trim();
			const guild = interaction.guild as Guild;

			// Si el usuario solicita la lista de opciones
			if (/^(list|lista)$/i.test(textoInput)) {
				const optionsList = Object.keys(optionAliases)
					.map((opt) => `❥ \`${opt}\``)
					.join(" - ");
				const listEmbed = new EmbedBuilder()
					.setTitle("__**Lista de Opciones**__")
					.setDescription(optionsList || "No hay opciones disponibles en este momento.")
					.setColor(COLORS.pyeWelcome)
					.setTimestamp();
				return await replyOk(interaction, [listEmbed]);
			}

			// Si el texto corresponde a una opción válida y no hay texto adicional
			const firstArg = textoInput.split(" ")[0].toLowerCase();
			const languageKey = optionAliases[firstArg];

			if (languageKey && textoInput.split(" ").length === 1) {
				// Obtener una imagen aleatoria del repositorio
				const imageUrl = await getRandomImageFromRepo(languageKey);
				if (!imageUrl) return await replyError(interaction, "No se pudo obtener una imagen para la opción especificada.");
				interaction.editReply({ files: [new AttachmentBuilder(imageUrl, { name: "komi.png" })] });
				return;
			}

			// Generar una imagen personalizada con el texto proporcionado
			// Cargar la imagen de fondo
			const canvas = Canvas.createCanvas(640, 480);
			const ctx = canvas.getContext("2d");
			const backgroundImage = await Canvas.loadImage(path.join(__dirname, `../../assets/Images/komi.png`)); // https://i.imgur.com/9udmQFS.png
			ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);

			// Procesar el texto
			let texto = textoInput;

			// Reemplazar menciones por nombres de usuario
			const mentions = interaction.options.getString("texto")?.match(/<@!?(\d+)>/g) || [];
			for (const mention of mentions) {
				const id = mention.replace(/<@!?/, "").replace(/>/, "");
				const member = await guild.members.fetch(id).catch(() => null);
				if (member) texto = texto.replace(mention, member.user.username);
			}

			// Validaciones de texto
			if (!texto || /discord\.gg|\.gg\/|\//i.test(texto)) texto = "discord.gg/programacion";

			const isDefaultText = texto === "discord.gg/programacion";

			if (texto.length > 240) return await replyError(interaction, "No puedes ingresar más de 240 caracteres.");

			// Dividir el texto en líneas si es necesario
			const maxCharsPerLine = 22;
			const lines: string[] = [];
			for (let i = 0; i < texto.length; i += maxCharsPerLine) {
				lines.push(texto.substring(i, i + maxCharsPerLine));
			}
			const finalText = lines.join("\n");

			// Configurar la fuente y estilo
			ctx.font = `bold ${isDefaultText ? 25 : 20}px Manrope`;
			ctx.fillStyle = "#090a09";
			ctx.textAlign = "center";

			// Determinar la posición del texto
			const textX = 320; // Centro del canvas
			const textY = isDefaultText ? 350 : 180;

			// Dibujar el texto en el canvas
			ctx.fillText(finalText, textX, textY);

			const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), {
				name: "komi.png",
			});

			interaction.editReply({ files: [attachment] });
		}
	),
} as Command;

// Función para obtener una imagen aleatoria de un lenguaje específico
async function getRandomImageFromRepo(language: string): Promise<string | null> {
	try {
		const response = await fetch(`${GITHUB_API_URL}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${language}`).catch((response) =>
			console.error(`Error al obtener contenido de GitHub: ${response?.status}`)
		);
		if (!response) return null;
		const data = await response.json();
		if (!Array.isArray(data)) {
			console.error("El formato de los datos recibidos no es válido.");
			return null;
		}

		// Filtrar solo archivos de imagen
		const images = data.filter((item) => item.type === "file" && /\.(png|jpg|jpeg|gif)$/i.test(item.name));

		if (images.length === 0) {
			console.error("No se encontraron imágenes en el directorio.");
			return null;
		}

		// Seleccionar una imagen aleatoria
		const randomImage = images[Math.floor(Math.random() * images.length)];

		// Construir la URL directa a la imagen
		const imageUrl = `${randomImage.download_url}`;

		return imageUrl;
	} catch (error) {
		console.error("Error al obtener la imagen del repositorio:", error);
		return null;
	}
}
