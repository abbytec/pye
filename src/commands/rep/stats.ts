import { SlashCommandBuilder, AttachmentBuilder, ChatInputCommandInteraction, TextChannel, GuildMember } from "discord.js";
import { Users } from "../../Models/User.js";
import { loadImage } from "@napi-rs/canvas";
import { HelperPoint } from "../../Models/HelperPoint.js";
import { getChannelFromEnv, getRepRolesByOrder, getRoleName, ROLES_REP_RANGE } from "../../utils/constants.js";
import path from "path";
import { fileURLToPath } from "url";
import { getRender } from "../../utils/canvas/card-render.js";
import { replyError } from "../../utils/messages/replyError.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { replyWarning } from "../../utils/messages/replyWarning.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
	group: "🥳 - Puntos de reputación",
	data: new SlashCommandBuilder()
		.setName("stats")
		.addUserOption((option) => option.setName("usuario").setDescription("menciona a un usuario").setRequired(false))
		.setDescription("Muestra todas las estadisticas de tu perfil dentro del servidor"),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction(false)],
		async (msg: IPrefixChatInputCommand) => {
			// get user
			const member = (await msg.options.getUser("usuario", false)) ?? msg.user;
			const guildMember = await msg.guild?.members.fetch(member.id).catch(() => null);

			// validate bot
			if (member.bot) return await replyError(msg, "Los bots no pueden tener puntos de ayuda.");

			// get data
			let data: any = (await HelperPoint.findOne({ _id: member.id })) ?? { points: 0 };
			let people = await HelperPoint.find().sort({ points: -1 });

			const points = data.points.toLocaleString();
			const userData = await Users.findOne({ id: member.id });
			const pyeCoins = userData?.bank?.toLocaleString() ?? "-";
			const rank = (people.findIndex((memberFromDB) => memberFromDB._id === member.id) + 1).toLocaleString() || "-";
			const avatar = await loadImage(member.displayAvatarURL({ extension: "png", forceStatic: true }));
			const name = member.username.length > 9 ? member.username.substring(0, 8).trim() + "..." : member.username;
			const role = guildMember ? getRole(guildMember) : null;
			if (!role) return replyWarning(msg, "El usuario seleccionado no tiene ningun rol de reputación.", member);
			const background = await loadImage(
				path.join(__dirname, `../../assets/Images/reputation/${role ? getRoleName(role.id) : "novato"}.jpg`)
			);

			const canvas = getRender({
				name,
				points,
				rank,
				avatar,
				background,
				pyeCoins,
				role,
			});

			// send avatar
			return replyOk(msg, [], undefined, undefined, [new AttachmentBuilder(canvas.toBuffer("image/jpeg"), { name: "rank.png" })]);
		},
		[]
	),
} as Command;

function getRole(member: GuildMember | undefined) {
	if (!member) return;
	let highestRole;
	let minPointsHigherRole: number = -1;
	for (const roleId of Object.entries(getRepRolesByOrder())) {
		const role = member.roles.cache.get(roleId[1]);
		if (role) {
			if (minPointsHigherRole < (ROLES_REP_RANGE[roleId[0] as keyof typeof ROLES_REP_RANGE] ?? 0)) {
				minPointsHigherRole = ROLES_REP_RANGE[roleId[0] as keyof typeof ROLES_REP_RANGE] ?? 0;
				highestRole = role;
			}
		}
	}

	return highestRole;
}
