import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { ICustomCommand } from "../../interfaces/ICustomCommand.ts";
import { COLORS } from "../../utils/constants.ts";

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
					url: "https://cdn.discordapp.com/attachments/1115058778736431104/1193713341995155628/Logo_Animado.gif",
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
				description:
					"1️⃣ **Si existe otro canal en el servidor que trata sobre tu pregunta, entonces publica en ese canal.** Tómate un tiempo para revisar los canales de este servidor, están ordenados por categorías.\n\n2️⃣ **Tu publicación debe ser lo más detallada posible.**\n\n3️⃣ **Recuerda leer <#845314420494434355>**\n\n4️⃣ **Si tu publicación no cumple con alguna de estas reglas se eliminará.**\n\n*Muchas gracias.*",
				thumbnail: {
					url: "https://cdn.discordapp.com/attachments/809180235810734110/1038917121549279292/Bannerreformed.jpg",
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
];

export default {
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

			try {
				await (interaction.channel as TextChannel).send({ embeds: faqEntry.embeds });
			} catch (error) {
				console.error("Error procesando el comando FAQ:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}
		}
	),
};
