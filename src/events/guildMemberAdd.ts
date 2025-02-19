import { Events, GuildMember, MessageFlags } from "discord.js";
import { ExtendedClient } from "../client.js";
import { Evento } from "../types/event.js";
import { getInitialRoles } from "../utils/constants.js";
import loadEnvVariables from "../utils/environment.js";

loadEnvVariables();

const regex = new RegExp(/(https?:\/\/[^\s]+)/i);
export default {
	name: Events.GuildMemberAdd,
	once: false,
	async execute(member: GuildMember) {
		if (regex.test(member?.user.displayName.toLocaleLowerCase())) return member.kick("spam");
		if (member.user.bot) return;
		member.roles.add(getInitialRoles(["novato"])).catch(() => null);
		member
			.createDM()
			.then(
				async (dm) =>
					await dm.send({
						content: `**__Bienvenido a Programadores y Estudiantes__** 💻 

🔗Nuestro enlace por si quieres invitar a un amigo: https://discord.com/invite/programacion

**Síguenos en nuestras redes y no te pierdas nada!**
<:x_:1341867476794867833> https://x.com/PyE_comunidad
<:Instagram:1341868157358444615> https://www.instagram.com/pye_chans/
<:youtube:1341867756080857108> https://www.youtube.com/@programadoresyestudiantes`,
						flags: MessageFlags.SuppressEmbeds,
					})
			)
			.catch(() => null);
		if (process.env.ENABLE_AUTO_WELCOME_MESSAGE) ExtendedClient.newUsers.add(member.id);
	},
} as Evento;
