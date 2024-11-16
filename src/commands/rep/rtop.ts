import { SlashCommandBuilder, ActionRowBuilder, EmbedBuilder, ButtonBuilder, ChatInputCommandInteraction, TextChannel } from "discord.js";
import { HelperPoint } from "../../Models/HelperPoint.ts";

export default {
	group: "🥳 - Puntos de reputación",
	data: new SlashCommandBuilder().setName("rtop").setDescription("Muestra el top de usuarios con más puntos de reputación"),
	execute: async (msg: ChatInputCommandInteraction, args: string[]) => {
		let page = parseInt(args?.[0] ?? 1) - 1;
		if (page < 0) page = 0;
		let all = Math.ceil((await HelperPoint.countDocuments()) / 10);
		if (all < 0) all = 0;
		if (page > all) page = all - 1;
		const allDocs = await HelperPoint.find().sort({ points: -1 });
		const position = allDocs.findIndex((u) => u._id === msg.user.id);
		const notPosition = isNaN(position) || position === -1;
		const content = async (disable = false) => {
			let users = await HelperPoint.find()
				.sort({ points: -1 })
				.skip(page * 10)
				.lean();
			users = users.slice(0, 10);

			return {
				embeds: [
					new EmbedBuilder()
						.setAuthor({ name: msg.user.tag, iconURL: msg.user.displayAvatarURL() })
						.setThumbnail("https://cdn.discordapp.com/attachments/916353103534632960/1035714342722752603/unknown.png")
						.addFields([
							{
								name: "Top puntos de reputación.",
								value:
									(
										await Promise.all(
											users.map(async (u, i) => {
												const member = await msg.guild?.members
													.fetch(u._id)
													.catch(() => ({ user: { username: u._id } }));
												return `**${page * 10 + i + 1}.** [${member?.user.username}](https://discord.com/users/${
													u._id
												}) • ${u.points.toLocaleString()} puntos.`;
											})
										)
									).join("\n") || "No hay usuarios en el top.",
							},
							{
								name: "Tu posición",
								value: notPosition ? "No te encontré en el top." : "#" + (position + 1),
							},
						])
						.setFooter({ text: `Página ${page + 1}/${all}` })
						.setTimestamp(),
				],
				components: [
					new ActionRowBuilder<ButtonBuilder>().addComponents(
						[
							new ButtonBuilder()
								.setStyle(1)
								.setLabel("«")
								.setCustomId("hp-topBack")
								.setDisabled(page - 1 < 0),
							new ButtonBuilder()
								.setStyle(1)
								.setLabel("»")
								.setCustomId("hp-topNext")
								.setDisabled(page + 1 >= all),
						].map((b) => (disable ? b.setDisabled(true) : b))
					),
				],
			};
		};

		let m = await (msg.channel as TextChannel).send(await content()).catch((e) => console.error(e));

		m?.createMessageComponentCollector({
			filter: (i) => i.user.id === msg.user.id && ["hp-topBack", "hp-topNext"].includes(i.customId),
			time: 60e3,
		})
			.on("collect", async (i) => {
				if (i.customId === "hp-topBack" && page >= 0) page--;
				else if (i.customId === "hp-topNext" && page < all) page++;
				else i.deferUpdate();
				i.update(await content());
			})
			.on("end", async () => m.edit(await content(true)).catch((e) => console.error(e)));
	},
};
