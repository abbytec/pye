import { SlashCommandBuilder, AttachmentBuilder, ChatInputCommandInteraction, TextChannel, GuildMember } from "discord.js";
import { Users } from "../../Models/User.js";
import { loadImage } from "@napi-rs/canvas";
import { HelperPoint } from "../../Models/HelperPoint.js";
import { getRepRolesByOrder, getRoleName } from "../../utils/constants.js";
import path from "path";
import { fileURLToPath } from "url";
import { getRender } from "../../utils/canvas/card-render.js";
import { replyError } from "../../utils/messages/replyError.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
	group: "🥳 - Puntos de reputación",
	data: new SlashCommandBuilder()
		.setName("stats")
		.addUserOption((option) => option.setName("usuario").setDescription("menciona a un usuario").setRequired(true))
		.setDescription("Muestra todas las estadisticas de tu perfil dentro del servidor"),
	execute: async (msg: ChatInputCommandInteraction) => {
		// get user
		const member = msg.options.getUser("usuario", true);
		const guildMember = await msg.guild?.members.fetch(member.id); // 'user' es de tipo 'User'

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
		const role = getRole(msg, guildMember);
		if (!role) return;
		const background = await loadImage(path.join(__dirname, `../../utils/Images/reputation/${getRoleName(role.id)}.jpg`));

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
		return ((msg.guild?.channels.cache.get(msg.channelId) ?? msg.guild?.channels.resolve(msg.channelId)) as TextChannel)
			.send({
				files: [new AttachmentBuilder(canvas.toBuffer("image/jpeg"), { name: "rank.png" })],
			})
			.catch((e) => console.error(e));
	},
};

function getRole(interaction: ChatInputCommandInteraction, member: GuildMember | undefined) {
	if (!member) return;
	for (const roleId of getRepRolesByOrder()) {
		const role = member.roles.cache.get(roleId);
		if (role) return role;
	}
}
