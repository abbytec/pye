import { ChatInputCommandInteraction, Guild, SlashCommandBuilder, User } from "discord.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { verifyHasRoles } from "../../utils/middlewares/verifyHasRoles.js";
import { updateRepRoles } from "../../utils/finalwares/updateRepRoles.js";
import { HelperPoint } from "../../Models/HelperPoint.js";
import { logMessages } from "../../utils/finalwares/logMessages.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

export default {
	group: "🥳 - Puntos de reputación",
	data: new SlashCommandBuilder()
		.setName("add-rep")
		.setDescription("Agrega puntos de ayuda.")
		.addUserOption((option) => option.setName("usuario").setDescription("selecciona el usuario").setRequired(true)),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyHasRoles("staff", "moderadorChats", "helper", "creadorDeRetos"), deferInteraction()],
		async (interaction: IPrefixChatInputCommand) => {
			const user = await interaction.options.getUser("usuario", true);
			if (!user) return;
			const channel = interaction.channel;

			try {
				const { member, data } = await addRep(user, interaction.guild).catch(async (error: any) => {
					await replyError(interaction, error.message);
					return { member: null, data: null };
				});
				if (!member || !data) return;
				await replyOk(interaction, `se le ha dado un rep al usuario: \`${user.tag}\``);
				return {
					guildMember: member,
					helperPoint: data,
					logMessages: [
						{
							channel: getChannelFromEnv("logPuntos"),
							content: `**${interaction.user.tag}** le ha dado un rep al usuario: \`${user.tag}\` en el canal: <#${channel?.id}>`,
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

export async function addRep(user: User | null, guild: Guild | null, points: number = 1) {
	if (user?.bot) throw new Error("No puedo darle puntos a los bots.\nUso: `add-rep [@Usuario]`");
	const member = await guild?.members.fetch(user?.id ?? "").catch(() => null);
	if (!member) throw new Error("No se pudo encontrar al usuario en el servidor.");

	let data = await HelperPoint.findOneAndUpdate({ _id: user?.id }, { $inc: { points: points } }, { new: true, upsert: true });

	if (!data) data = await HelperPoint.create({ _id: user?.id, points: 1 });

	return { member, data };
}
