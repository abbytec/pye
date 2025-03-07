import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, Events, GuildMember, MessageFlags } from "discord.js";
import { ExtendedClient } from "../client.js";
import { Evento } from "../types/event.js";
import { COLORS, getChannelFromEnv, getInitialRoles } from "../utils/constants.js";
import loadEnvVariables from "../utils/environment.js";
import { ruleData } from "../commands/help/rule.js";

loadEnvVariables();

const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
	new ButtonBuilder().setCustomId("mostrar_reglas").setLabel("Mostrar Reglas").setStyle(ButtonStyle.Primary),
	new ButtonBuilder().setCustomId("consejos").setLabel("Consejos").setStyle(ButtonStyle.Primary)
);

const regex = new RegExp(/(https?:\/\/[^\s]+)/i);
export default {
	name: Events.GuildMemberAdd,
	once: false,
	async execute(member: GuildMember) {
		if (regex.test(member?.user.displayName.toLocaleLowerCase())) return member.kick("spam");
		if (member.user.bot || member.guild.id !== process.env.GUILD_ID) return;
		member.roles.add(getInitialRoles(["novato"])).catch(() => null);
		member
			.createDM()
			.then(async (dm) => {
				const welcomeMsg = await dm.send({
					content: `**__Bienvenido a Programadores y Estudiantes__** 💻 

🔗Nuestro enlace por si quieres invitar a un amigo: https://discord.com/invite/programacion

**Síguenos en nuestras redes y no te pierdas nada!**
<:x_:1341867476794867833> https://x.com/PyE_comunidad
<:Instagram:1341868157358444615> https://www.instagram.com/pye_chans/
<:youtube:1341867756080857108> https://www.youtube.com/@programadoresyestudiantes`,
					flags: MessageFlags.SuppressEmbeds,
					components: [row],
				});
				const collector = welcomeMsg.createMessageComponentCollector({
					time: 2 * 60 * 1000,
					filter: (interaction) => interaction.user.id === member.id,
				});
				collector.on("collect", async (interaction) => {
					let embed = new EmbedBuilder()
						.setColor(COLORS.pyeLightBlue)
						.setFooter({ text: "Esperamos que disfrutes de la comunidad 💙" });
					if (interaction.customId === "consejos") {
						embed.setTitle("Reglas").addFields(
							{
								name: "Programación",
								value: `👥 Usen <#${getChannelFromEnv(
									"chatProgramadores"
								)}> para hablar principalmente de programación y eviten usarlo con otros fines.`,
								inline: false,
							},
							{
								name: "Conversación",
								value: `👥 Usen <#${getChannelFromEnv(
									"general"
								)}> para conversar de cualquier otro tema y eviten tomarse en serio lo que digan otros usuarios.\n Este canal es principalmente para socializar.`,
								inline: false,
							},
							{
								name: "Foros",
								value: `Si tienes dudas, puedes publicarlas en alguno de los foros. Si tu duda no encaja en ninguno de los canales, utiliza <#${getChannelFromEnv(
									"ayuda-general"
								)}> <:arma:996504866673406092>\nAsegurense de usar un **título descriptivo** y poner la mayor cantidad de **detalles** así su pregunta no es **ignorada**.\nY recuerda agradecerle a quien te brinde ayuda.`,
								inline: false,
							}
						);
					}
					if (interaction.customId === "mostrar_reglas") {
						embed.setTitle("Reglas").addFields(
							ruleData.map((rule) => ({
								name: rule.embeds?.at(0)?.title ?? "",
								value: rule.embeds?.at(0)?.description ?? "",
								inline: false,
							}))
						);
					}
					await interaction.reply({ embeds: [embed] });
				});
				collector.on("end", async () => {
					await welcomeMsg.edit({
						components: [],
					});
				});
			})
			.catch(() => null);
		if (process.env.ENABLE_AUTO_WELCOME_MESSAGE) ExtendedClient.newUsers.add(member.id);
	},
} as Evento;
