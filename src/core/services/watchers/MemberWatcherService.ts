import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	Events,
	GuildMember,
	MessageFlags,
	PartialGuildMember,
	TextChannel,
} from "discord.js";
import { CoreClient } from "../../CoreClient.js";
import { IService } from "../../IService.js";
import { ExtendedClient } from "../../../client.js";
import { COLORS, getChannelFromEnv, getInitialRoles, getRoleFromEnv } from "../../../utils/constants.js";
import generateCanvaBoosterId from "../../../utils/canvas/boostNotice.js";
import { ruleData } from "../../../commands/help/rule.js";
import { addRep } from "../../../commands/rep/add-rep.js";
import { logHelperPoints } from "../../../utils/logHelperPoints.js";

const urlRegex = /(https?:\/\/[^\s]+)/i;

export default class MemberWatcherService implements IService {
	public readonly serviceName = "memberWatcher";

	constructor(private readonly client: CoreClient) {}

	start() {
		this.client.on(Events.GuildMemberAdd, (member: GuildMember) => void this.onGuildMemberAdd(member));
		this.client.on(Events.GuildMemberRemove, (member: GuildMember | PartialGuildMember) => void this.onGuildMemberRemove(member));
		this.client.on(
			Events.GuildMemberUpdate,
			(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => void this.onGuildMemberUpdate(oldMember, newMember)
		);
	}

	private async onGuildMemberAdd(member: GuildMember) {
		if (urlRegex.test(member?.user.displayName.toLowerCase())) return member.kick("spam");
		if (member.user.bot || member.guild.id !== process.env.GUILD_ID) return;

		member.roles.add(getInitialRoles(["novato"])).catch(() => null);

		const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
			new ButtonBuilder().setCustomId("mostrar_reglas").setLabel("Mostrar Reglas").setStyle(ButtonStyle.Primary),
			new ButtonBuilder().setCustomId("consejos").setLabel("Consejos").setStyle(ButtonStyle.Primary)
		);

		member
			.createDM()
			.then(async (dm) => {
				const welcomeMsg = await dm.send({
					content: `**__Bienvenido a Programadores y Estudiantes__** 💻 

🔗Nuestro enlace por si quieres invitar a un amigo: https://discord.com/invite/programacion

**Síguenos en nuestras redes y no te pierdas nada!**`,
					flags: MessageFlags.SuppressEmbeds,
					components: [row],
				});

				const collector = welcomeMsg.createMessageComponentCollector({
					time: 2 * 60 * 1000,
					filter: (interaction) => interaction.user.id === member.id,
				});
				collector.on("collect", async (interaction) => {
					const embed = new EmbedBuilder()
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
								)}>\nAsegúrense de usar un **título descriptivo** y poner la mayor cantidad de **detalles** así su pregunta no es **ignorada**.\nY recuerda agradecerle a quien te brinde ayuda.`,
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

		const client = member.client as ExtendedClient;
		const channelId = getChannelFromEnv("invitaciones");
		const channel = (client.channels.cache.get(channelId) ?? client.channels.resolve(channelId)) as TextChannel | null;
		if (!channel?.isTextBased()) return;

		const newInvites = await member.guild.invites.fetch();
		const usedInvite = newInvites.find((inv) => (client.invites.get(inv.code) ?? 0) < (inv.uses ?? 0));

		newInvites.forEach((inv) => client.invites.set(inv.code, inv.uses ?? 0));
		client.invites.forEach((_, code) => {
			if (!newInvites.has(code)) client.invites.delete(code);
		});

		const inviter = usedInvite?.inviter ? `<@${usedInvite?.inviter.id}>` : "Desconocido";
		const inviteInfo = usedInvite ? `\`${usedInvite.code}\` por ${inviter}` : "Desconocida";

		const embed = new EmbedBuilder()
			.setTitle("Usuario ingresó")
			.setColor(COLORS.okGreen)
			.setDescription(`<@${member.id}> (${member.user.username}) se unió al servidor`)
			.addFields({ name: "Invitación", value: inviteInfo })
			.setTimestamp();

		channel.send({ embeds: [embed] }).catch((err) => {
			console.error("Error al loguear entrada de usuario:", err);
		});
	}

	private async onGuildMemberRemove(member: GuildMember | PartialGuildMember) {
		if (member.guild.id !== process.env.GUILD_ID) return;
		const fullMember = member.partial ? await member.fetch().catch(() => null) : member;
		if (!fullMember) return;

		const client = fullMember.client as ExtendedClient;
		const channelId = getChannelFromEnv("invitaciones");
		const channel = (client.channels.cache.get(channelId) ?? client.channels.resolve(channelId)) as TextChannel | null;
		if (!channel?.isTextBased()) return;

		const roles =
			fullMember.roles.cache
				.filter((r) => r.id !== fullMember.guild.id)
				.map((r) => `<@&${r.id}>`)
				.join(", ") || "Sin roles";

		const embed = new EmbedBuilder()
			.setTitle("Usuario salió")
			.setColor(COLORS.errRed)
			.setDescription(`<@${fullMember.id}> (${fullMember.user.username}) salió del servidor`)
			.addFields({ name: "Roles", value: roles })
			.setTimestamp();

		channel.send({ embeds: [embed] }).catch((err) => {
			console.error("Error al loguear salida de usuario:", err);
		});
	}

	private async onGuildMemberUpdate(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
		if (oldMember.user.bot || newMember.user.bot) return;
		if (oldMember.partial) {
			const oldMemberResolved = await oldMember.fetch().catch((error) => {
				console.error("Error al obtener información del miembro antiguo:", error);
				return undefined;
			});

			if (!oldMemberResolved) return;
		}

		await this.handleRoleChanges(oldMember, newMember, this.client as ExtendedClient);
		await this.handleNicknameChange(oldMember, newMember);
	}

	private async handleRoleChanges(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember, client: ExtendedClient) {
		const oldRoles = oldMember.roles.cache;
		const newRoles = newMember.roles.cache;

		const addedRoles = newRoles.filter((role) => !oldRoles.has(role.id));
		const removedRoles = oldRoles.filter((role) => !newRoles.has(role.id)).map((role) => role.id);

		const initialRoles = getInitialRoles([]);

		removedRoles.forEach(async (element) => {
			if (initialRoles.includes(element)) {
				await newMember.roles.add(element);
			}
		});

		if (addedRoles.has(getRoleFromEnv("vip"))) {
			await addRep(newMember.user, newMember.guild)
				.then(({ member }) => logHelperPoints(member.guild, `\`${member.user.username}\` ha obtenido 1 rep por obtener el Rol VIP`))
				.catch((error) => ExtendedClient.logError(`Error agregando +1 rep por Rol VIP: ${error.message}`, error.stack, newMember.id));
		}
		if (addedRoles.has(getRoleFromEnv("nitroBooster"))) {
			newMember.roles.add(getRoleFromEnv("nitroOldBooster"));
			const channel = (client.channels.cache.get(getChannelFromEnv("starboard")) ??
				client.channels.resolve(getChannelFromEnv("starboard"))) as TextChannel;
			const embed = new EmbedBuilder()
				.setTitle("🎉 Nuevo PyE-Booster 🎉")
				.setDescription("¡Gracias por apoyar nuestra comunidad! 🦄")
				.addFields(
					{ name: `😎 ${newMember.user.username} ha mejorado el servidor 🚀`, value: "\u200B" },
					{
						name: "Algunas de las ventajas para ti:",
						value: "🔹 Prioridad de voz en los canales.\n🔹 Capacidad de crear hilos.\n🔹 Rol permanente que demuestra tu apoyo.\n🔹 Atención priorizada en el servidor.\n🔹 ¡Muchas más ventajas que iremos agregando!",
					},
					{ name: "💡 ¿Tienes sugerencias para boosters?", value: `¡Déjalas en <#${getChannelFromEnv("sugerencias")}>!` }
				)
				.setColor(COLORS.nitroBooster)
				.setImage("attachment://booster.png")
				.setFooter({ text: "¡Este lugar del starboard es para ti!" });
			const boosterImg = new AttachmentBuilder(await generateCanvaBoosterId(newMember), { name: "booster.png" });
			channel.send({ content: `<@${newMember.id}>`, embeds: [embed], files: [boosterImg] });
		}
	}

	private async handleNicknameChange(oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) {
		const oldNickname = oldMember.nickname;
		const oldDisplayName = oldMember.user.displayName;
		const newDisplayName = newMember.user.displayName;

		if (oldDisplayName !== newDisplayName) {
			if (urlRegex.test(newDisplayName.toLowerCase())) {
				await newMember
					.setNickname("$." + newMember.user.username, "DisplayName contenía una URL. Apodado automáticamente.")
					.catch((error) => console.error(`No se pudo cambiar el apodo de ${newMember.user.tag}:`, error));
			} else if (oldNickname?.startsWith("$.") && !urlRegex.test(newDisplayName.toLowerCase())) {
				await newMember
					.setNickname(null, "DisplayName anterior contenía una URL y el actual no. Autoapodo restablecido automáticamente.")
					.catch((error) => console.error(`No se pudo cambiar el apodo de ${newMember.user.tag}:`, error));
			}
		}
	}
}

