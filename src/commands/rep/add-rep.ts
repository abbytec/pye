import { Guild, GuildMember, SlashCommandBuilder, User } from "discord.js";
import { getChannelFromEnv, getRoleFromEnv } from "../../utils/constants.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../composables/middlewares/verifyHasRoles.js";
import { updateRepRoles } from "../../composables/finalwares/updateRepRoles.js";
import { HelperPoint } from "../../Models/HelperPoint.js";
import { logMessages } from "../../composables/finalwares/logMessages.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";

export default {
	group: "🥳 - Puntos de reputación",
	data: new SlashCommandBuilder()
		.setName("add-rep")
		.setDescription("Agrega puntos de ayuda.")
		.addUserOption((option) => option.setName("usuario").setDescription("selecciona el usuario").setRequired(true))
		.addIntegerOption((option) => option.setName("cantidad").setDescription("cantidad de puntos").setRequired(false)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "moderadorChats", "helper", "creadorDeRetos"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true);
			if (!user) return;
			if (user.id === interaction.user.id) return await replyError(interaction, "No puedes darte puntos a ti mismo.");
			const channel = interaction.channel;
			const amount = interaction.options.getInteger("cantidad") ?? 1;

			try {
				const { member, data } = await addRep(user, interaction.guild, amount).catch(async (error: any) => {
					await replyError(interaction, error.message);
					return { member: null, data: null };
				});
				if (!member || !data) return;
				const repManager = interaction.member as GuildMember;
				const author =
					repManager.roles.cache.has(getRoleFromEnv("helper")) &&
					!repManager.roles.cache.has(getRoleFromEnv("moderadorChats")) &&
					!repManager.roles.cache.has(getRoleFromEnv("staff"))
						? null
						: undefined;
				await replyOk(interaction, `se le ha dado **${amount == 1 ? "un" : amount}** rep al usuario: \`${user.tag}\``, author);

				checkQuestLevel({ msg: interaction, userId: user.id, rep: amount } as IQuest);
				return {
					guildMember: member,
					helperPoint: data,
					logMessages: [
						{
							channel: getChannelFromEnv("logPuntos"),
							content: `**${interaction.user.tag}** le ha dado **${amount == 1 ? "un" : amount}** rep al usuario: \`${
								user.tag
							}\` en el canal: <#${channel?.id}>\n> *Puntos anteriores: ${data.points - amount}. Puntos actuales: ${data.points}*`,
						},
					],
				};
			} catch (error: any) {
				return await replyError(interaction, error.message);
			}
		},
		[updateRepRoles, logMessages]
	),
} as Command;

export async function addRep(user: User | string | null, guild: Guild | null, points: number = 1) {
	const userId = typeof user === "string" ? user : user?.id;
	if (!userId) throw new Error("No se proporcionó user ni id válido.");
	if (typeof user !== "string" && user?.bot) throw new Error("No puedo darle puntos a los bots.");
	const member = await guild?.members.fetch(userId ?? "").catch(() => null);
	if (!member) throw new Error("No se pudo encontrar al usuario en el servidor.");

	let data = await HelperPoint.findOneAndUpdate({ _id: userId }, { $inc: { points } }, { new: true, upsert: true });

	if (!data) data = await HelperPoint.create({ _id: userId, points });

	return { member, data };
}
