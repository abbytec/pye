import { SlashCommandBuilder, AttachmentBuilder, ChatInputCommandInteraction, EmbedBuilder, TextChannel, User, GuildMember } from "discord.js";
import { Users } from "../../Models/User.ts";
import { loadImage } from "@napi-rs/canvas";
import { HelperPoint } from "../../Models/HelperPoint.ts";
import { getRepRolesByOrder, getRoleName } from "../../utils/constants.ts";
import path from "path";
import { fileURLToPath } from "url";
import { getRender } from "../../utils/canvas/card-render.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
	data: new SlashCommandBuilder()
		.setName("stats")
		.addUserOption((option) => option.setName("usuario").setDescription("menciona a un usuario").setRequired(true))
		.setDescription("Muestra todas las estadisticas de tu perfil dentro del servidor"),
	execute: async (msg: ChatInputCommandInteraction) => {
		// get user
		const member = msg.options.getUser("usuario", true);
		const guildMember = await msg.guild?.members.fetch(member.id); // 'user' es de tipo 'User'

		// validate bot
		if (member.bot) {
			const embed = new EmbedBuilder()
				.setColor(0xff0000)
				.setDescription("<:cross_custom:913093934832578601> - Los bots no pueden tener puntos de ayuda.");
			return msg.reply({ embeds: [embed], ephemeral: true }); // 'ephemeral' hace que el mensaje sea visible solo para el usuario que ejecutó el comando
		}

		// get data
		let data: any = await HelperPoint.findOne({ _id: member.id });
		if (!data) {
			data = { points: 0 };
		}
		let people = await HelperPoint.find().sort({ points: -1 }).exec();

		const points = data.points.toLocaleString();
		const userData = await Users.findOne({ id: member.id }).exec();
		const pyeCoins = userData?.bank?.toLocaleString() ?? "-";
		const rank = (people.findIndex((memberFromDB) => memberFromDB._id === member.id) + 1).toLocaleString() || "-";
		const avatar = await loadImage(member.displayAvatarURL({ extension: "png", forceStatic: true }));
		const name = member.username.length > 9 ? member.username.substring(0, 8).trim() + "..." : member.username;
		const role = getRole(guildMember);
		console.log(role);
		if (!role) return;
		console.log("B");
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
		return (msg.channel as TextChannel)
			.send({
				files: [new AttachmentBuilder(canvas.toBuffer("image/jpeg"), { name: "rank.png" })],
			})
			.catch(() => null);
	},
};

function getRole(member: GuildMember | undefined) {
	if (!member) return;
	for (const roleId of getRepRolesByOrder()) {
		const role = member.roles.cache.get(roleId);
		if (role) return role;
	}
}
