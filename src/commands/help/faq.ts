import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel, CacheType } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ICustomCommand } from "../../interfaces/ICustomCommand.ts";
import { COLORS, getChannelFromEnv } from "../../utils/constants.ts";

const faqData: ICustomCommand[] = [
	{
		name: "cual-lenguaje",
		embeds: [
			{
				title: "¿Por cuál lenguaje empezar a programar?",
				color: COLORS.pyeLightBlue,
				description:
					"Es normal que esta sea tu primer pregunta al momento de querer iniciar, sin embargo debes saber que no es una forma correcta de empezar.\nLo mejor es que si no tienes nada de experiencia empieces por entender lo que es el concepto de *algoritmo*. Después de eso es muy importante que desarrolles tu lógica de programador (teniendo esta base podrás aprender el lenguaje que tú quieras con mucha más facilidad).\n\n1️⃣ **Investiga lo que es un Algoritmo.**\n2️⃣ **Aprende y practica pseudocódigo**, en YouTube hay varios cursos de PSeInt, el cual es un programa que te ayudará a practicar tu lógica, pseudocódigo y a familiarizarte con las estructuras de los lenguajes de programación.\n3️⃣ **Asegúrate de estudiar bien las estructuras, operandos y tener una configuración estricta en PSeInt** antes de empezar a resolver ejercicios.",
				fields: [
					{
						name: "__Descargar PSeInt__",
						value: "👉 http://pseint.sourceforge.net/\n\n__Introducción a la informática - Algoritmos resueltos__ \n👉 http://www.profmatiasgarcia.com.ar/uploads/tutoriales/Ej_resueltos_algoritmos.pdf\n\n__Páginas para practicar lógica con lenguajes de programación__\n👉 https://www.codewars.com/\n👉 https://www.hackerrank.com/\n👉 https://www.sololearn.com/home",
					},
				],
			},
		],
	},
	{
		name: "respuestas-rapidas",
		embeds: [
			{
				title: "Cómo obtener respuestas rápidamente",
				color: COLORS.pyeLightBlue,
				description:
					"[⍻] **NO** preguntar si hay alguien disponible o algún experto para resolver tu duda.\n\n[✓] **SÍ** colocar directamente tu duda concreta, detallando lo mejor que puedas, ayudando a cualquiera que pueda resolverla con imágenes, líneas de código o cualquier cosa que pueda facilitar la comprensión de tu problema a resolver.",
			},
		],
	},
	{
		name: "ide",
		embeds: [
			{
				title: "¿Qué IDE/Editor de texto es mejor?",
				color: COLORS.pyeLightBlue,
				description:
					"Para aclarar, IDE y Editor de Texto no es lo mismo. Un IDE tiene muchas herramientas: debugger, scaffolding, generadores, editor de texto, etc. Una app es un Editor de Texto en el momento que reconoce la sintaxis de un lenguaje de programación (se pueden agregar plugins al Editor de Texto, también al IDE).\n\nCada IDE se acopla a necesidades diferentes, utiliza el que están usando en el curso que sigues.\n\nCon los editores pasa igual que con los IDEs, cada uno tiene sus ventajas y desventajas, utiliza el que mejor se adapte a tus necesidades. Aquí algunos de los más usados actualmente:\n\n**Visual Studio Code** (El mejor para empezar)\n👉 https://code.visualstudio.com/\n\n**Sublime Text**\n👉 https://www.sublimetext.com/\n\n**Eclipse** (soporta Java, C++, PHP, TypeScript/JavaScript)\n👉 https://eclipseide.org",
				thumbnail: {
					url: "logo",
				},
			},
		],
	},
	{
		name: "canales-de-ayuda",
		embeds: [
			{
				title: "Reglas de Ayuda General",
				color: COLORS.pyeLightBlue,
				description: `1️⃣ **Si existe otro canal en el servidor que trata sobre tu pregunta, entonces publica en ese canal.** Tómate un tiempo para revisar los canales de este servidor, están ordenados por categorías.\n\n2️⃣ **Tu publicación debe ser lo más detallada posible.**\n\n3️⃣ **Recuerda leer <#${getChannelFromEnv(
					"reglas"
				)}>**\n\n4️⃣ **Si tu publicación no cumple con alguna de estas reglas se eliminará.**\n\n*Muchas gracias.*`,
				thumbnail: {
					url: "banner",
				},
			},
		],
	},
	{
		name: "faq",
		embeds: [
			{
				title: "Preguntas Frecuentes",
				color: COLORS.pyeLightBlue,
				description:
					"`¿Por cuál lenguaje debo empezar?`\nEs normal que esta sea tu primer pregunta al momento de querer iniciar, sin embargo debes saber que no hay una forma correcta de empezar.\n\nLo mejor es que si no tienes nada de experiencia empieces por entender lo que es el concepto de algoritmo. Después de eso es muy importante que desarrolles tu lógica de programador (teniendo esta base podrás aprender el lenguaje que tú quieras con mucha más facilidad).\n\n1️⃣ **Investiga lo que es un Algoritmo.**\n\n2️⃣ **Aprende y practica pseudocódigo**, en YouTube hay varios cursos de PSeInt, el cual es un programa que te ayudará a practicar tu lógica, pseudocódigo y a familiarizarte con las estructuras de los lenguajes de programación.\n\n3️⃣ **Asegúrate de estudiar bien las estructuras, operandos y tener una configuración estricta en PSeInt** antes de empezar a resolver ejercicios.\n\n**Descargar PSeInt**\n👉 http://pseint.sourceforge.net/\n\n**Algoritmos resueltos - Introducción a la informática**\n👉 https://www.profmatiasgarcia.com.ar/uploads/tutoriales/Ej_resueltos_algoritmos.pdf\n\n**Páginas para practicar lógica con lenguajes de programación**\n👉 https://www.codewars.com/\n👉 https://www.hackerrank.com/\n👉 https://www.sololearn.com/home\n\n`¿Qué área de programación debo elegir?`\n✅ Depende, si lo que quieres es hacer páginas web y apps, ve a front-end; si lo que quieres es hacer programas y demás, ve por back-end...\n\n👉 Aunque es bastante recomendable empezar por HTML, CSS y JavaScript, para darle una probadita al gigante pastel de la programación.\n\n✅ De ahí puedes irte a otros como Java, Lua, Dart, Python... Un mundo diverso bastante útil.\n👉 No te olvides que ninguno es superior a otro, sino que va orientado a otra cosa.\n\n`¿Qué IDE/Editor de texto es mejor?`\nPara aclarar, IDE y Editor de Texto no es lo mismo. Un IDE tiene muchas herramientas: debugger, scaffolding, generadores, editor de texto, etc. Una app es un Editor de Texto en el momento que reconoce la sintaxis de un lenguaje de programación (se pueden agregar plugins al Editor de Texto, también al IDE).\n\nCada IDE se acopla a necesidades diferentes, utiliza el que están usando en el curso que sigues.\n\nCon los editores pasa igual que con los IDEs, cada uno tiene sus ventajas y desventajas, utiliza el que mejor se adapte a tus necesidades. Aquí algunos de los más usados actualmente:\n\n**Visual Studio Code**\n👉 https://code.visualstudio.com/\n\n**Sublime Text**\n👉 https://www.sublimetext.com/\n\n**VSCodium**\n👉 https://vscodium.com/\n\nPrueba de rendimiento entre los editores:\n👉 https://blog.xinhong.me/post/sublime-text-vs-vscode-vs-atom-performance-dec-2016/",
				footer: {
					text: "¡Suerte!",
				},
			},
		],
	},
	{
		name: "matematicas",
		embeds: [
			{
				title: "¿Necesito saber matemáticas para programar?",
				color: COLORS.pyeLightBlue,
				description:
					"Es tema de constante debate. El consenso en este servidor es que se puede programar —e incluso ganar dinero— sin saber matemáticas, pero no saberlas puede volverse una limitación. Por ejemplo:\n\n1️⃣ **Para algunos dominios de aplicación.** Programar un catálogo de clientes para un contador no requiere de matemáticas. Programarle una depreciación para sus clientes, sí. Aun cuando se nos provea de una fórmula, saber matemáticas nos ayudará a interpretarla para su implementación. También será más fácil estimar el resultado esperado y validar nuestra implementación por nosotros mismos.\n\n2️⃣ **Para ser independientes de librerías, frameworks y plataformas.** A veces las librerías presentan limitaciones y debemos diagnosticarlas, corregirlas o hasta reimplementarlas. Por ejemplo, si la licencia de una librería resulta incompatible con nuestras intenciones comerciales, podríamos necesitar implementar nuestra propia librería. Una librería también podría tener bugs, estar incompleta, ser ineficiente, etc., pero aun así optar por seguirla utilizando, corrigiendo de nuestro lado las limitaciones.",
				thumbnail: {
					url: "https://matematicadicreta.files.wordpress.com/2013/01/clases-de-matematica-y-fisica_mlv-o-3326115238_1020121.jpg",
				},
				fields: [
					{
						name: "**Algunas áreas de las matemáticas y sus aplicaciones:**",
						value: "• **Aritmética y los básicos de álgebra:** fundamentos generales como cálculos de un descuento, manejo de porciones, porcentaje de progreso, fenómenos físicos simples, etc.\n• **Geometría y trigonometría:** para implementación de gráficas y renderizados.\n• **Cálculo:** para la descripción de fenómenos físicos complejos, poblacionales, financieros, etc., así como el control industrial.\n• **Matemática discreta:** para la ciencia de la computación.\n• **Estadística:** para la ciencia de datos y modelado de predicciones.",
					},
				],
			},
		],
	},
	{
		name: "psicologo",
		content:
			"Si tienes problemas emocionales o de vida personal, no confies en un chat lleno de extraños, intenta conseguir ayuda profesional.",
	},
	{
		name: "nsfw",
		content:
			'N.S.F.W en español significa "No Apto Para Trabajo", por el bien de la comunidad, si deseas poner una imagen y esta en duda si esta rompe las reglas usa el modo spoiler.\n( Aun así poner contenido erotico o explícito puede ser motivo de ban/sanción )\nhttps://i.imgur.com/2RQENow.png',
	},
	{
		name: "comandos",
		content:
			"### Algunos de los comandos de uso común \n* /bienvenido `Da la bienvenida y otorga información básica del servidor`\n* /stats `Obtiene una tarjeta con tus datos de valor en el servidor`\n* /faq nsfw `Ayuda a mantener una comunidad mas sana explicando el NSFW`\n* /faq ticket `Información sobre crear tickets`\n* /faq rep `Información básica sobre el sistema de reputación`\n* /faq psicologo `Pequeño consejo para aquellos que necesitan ayuda psicologica`",
	},
	{
		name: "code",
		embeds: [
			{
				title: "Formatear código.",
				color: COLORS.pyeLightBlue,
				description:
					"Para que tu código sea más facil de leer en los chats y queden de una forma más profesional debes envolverlo al principio y al final con triple comilla invertida (backticks) Alt + 96",
				image: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/924734160441057360/code.png",
				},
			},
		],
	},
	{
		name: "check",
		content: "**Pon el enlace que quieras analizar en:**\n> https://sitecheck.sucuri.net/",
	},
	{
		name: "invite",
		embeds: [
			{
				title: "Comparte este enlace con quien quieras!",
				color: COLORS.pyeLightBlue,
				description: "https://discord.gg/programacion",
				image: {
					url: "banner",
				},
			},
		],
	},
	{
		name: "google",
		embeds: [
			{
				title: "Intenta siempre primero resolver tus dudas a través de Google",
				color: COLORS.pyeLightBlue,
				description:
					"https://www.google.com/\n\n*Recuerda que las búsquedas relacionadas en programación regularmente suelen hacerse en Inglés por lo que es importante que siempre trates de hacer la búsqueda en Inglés por ejemplo : “How to create an array javascript”*",
				image: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/980173255023394948/jix.png",
				},
				footer: {
					text: "Haz tus preguntas solamente para dudas muy concretas que no se puedan realizar en google.",
				},
			},
		],
	},
	{
		name: "disclaimer",
		embeds: [
			{
				title: "Disclaimer",
				color: COLORS.pyeLightBlue,
				description:
					"👉El staff **no** intervendrá  para resolver conflictos interpersonales que ocurran debido a los canales autocreados (véase que un usuario te expulsó de su canal). Para evitar esta clase de situaciones puedes usar los canales donde los usuarios no pueden moderar <#907484044445499432> , <#907484185688682506>, <#796580264867266581> y <#805095903618400276>\n\n👉El staff **si** puede interactuar cuando:\n**-**Un usuario esté compartiendo cosas indebidas en pantalla o haciendo ruidos molestos.\n**-**Un usuario entre y salga repetidamente de un canal con claras intenciones de molestar.\n**-**Casos extremos de acoso el cual estén bien documentados como para poder proceder.\n**-**Se muestren evidencias concretas de que un usuario se está aprovechando de otros ya sea por lo que fuese, estafa, doxeos, phising, etc.\n\n*El staff no posee clarividencia , ni tiene registros de lo que pasa en los canales de voz a cada momento (ni siquiera Discord lo tiene),  tampoco el staff tiene poder u obligación con  lo que sucede fuera de este servidor.*",
				thumbnail: {
					url: "banner",
				},
			},
		],
	},
	{
		name: "twitter",
		embeds: [
			{
				title: "El Twitter del servidor <:basado:878018935772033094>",
				color: COLORS.pyeLightBlue,
				description: "https://twitter.com/PyE_comunidad",
				thumbnail: {
					url: "logo",
				},
				footer: {
					text: "síguenos por favor!",
				},
			},
		],
	},
	{
		name: "ticket",
		content: `Crea un  <#${getChannelFromEnv(
			"tickets"
		)}>  para reportar algún problema o mala conducta de un usuario, si el ticket resulta válido se te otorgará un punto de reputación.`,
	},
	{
		name: "rep",
		content:
			"**__Los rangos《✯》son el rol principal de este servidor.__**\n\nPuedes obtener más información de como ganar puntos rep [AQUÍ](https://discord.com/channels/768278151435386900/999427534670278667/999429684473380914)\n\n❗ Puedes ver la cantidad de puntos que llevas siempre que quieras usando el comando **!stats** o puedes visualizar top general usando el comando **!rtop**",
	},
	{
		name: "recuperar-cuenta",
		embeds: [
			{
				title: "No puedo recuperar mi cuenta, qué puedo hacer?",
				color: COLORS.pyeLightBlue,
				description:
					'Esta pregunta se da frecuentemente. Desafortunadamente, nosotros no tenemos la capacidad de hacer nada adicional a lo que tú mismo puedas hacer. Tus mejores posibilidades son:\n\n1. Usar las opciones de "olvidé mi contraseña". Te harán seguir un procedimiento.\n\n2. Si lo anterior no funciona, contacta a Soporte Técnico del proveedor de tu cuenta. Tendrás que buscar cuál es el medio de contacto de Soporte Técnico de tu proveedor.\n\nRecuerda que no hay garantía de que te restauren el acceso a tu cuenta, especialmente si no logran comprobar que tú eres el dueño. Por eso, lo más importante es que tomes las medidas necesarias para evitar perder la cuenta en primer lugar.',
				thumbnail: {
					url: "https://i.pinimg.com/564x/76/38/69/763869a33c8ac9e99a59500992c11127.jpg",
				},
			},
		],
	},
	{
		name: "inayudable",
		embeds: [
			{
				title: "Hola mi estimad@ colega!",
				color: COLORS.pyeLightBlue,
				description:
					"Para poder ayudarte mejor, ¿Podrías compartir con nosotros mas detalles? Por ejemplo, pasar una captura de tu código e indicarnos donde necesitas ayuda",
			},
		],
	},
];

export default {
	group: "📜 - Ayuda",
	data: new SlashCommandBuilder()
		.setName("faq")
		.setDescription("Muestra preguntas frecuentes.")
		.addStringOption((option) =>
			option
				.setName("tema")
				.setDescription("El tema de la FAQ")
				.setRequired(true)
				.addChoices(...faqData.map((faq) => ({ name: faq.name, value: faq.name })))
		),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? "")],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const tema = interaction.options.getString("tema", true);
			const faqEntry = faqData.find((faq) => faq.name === tema);

			if (!faqEntry) {
				return await replyError(interaction, "No se encontró esa sección de FAQ.");
			}

			if (faqEntry.embeds) {
				let embed = faqEntry.embeds.at(0);
				if (embed?.thumbnail?.url === "banner") embed.thumbnail.url = interaction.guild?.bannerURL() ?? "";
				if (embed?.thumbnail?.url === "logo") embed.thumbnail.url = interaction.guild?.iconURL() ?? "";
			}

			try {
				await interaction.reply({ embeds: faqEntry.embeds, content: faqEntry.content });
			} catch (error) {
				console.error("Error procesando el comando FAQ:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}
		}
	),
};
