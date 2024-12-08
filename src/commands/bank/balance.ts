import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, AttachmentBuilder, EmbedBuilder } from "discord.js";
import { getOrCreateUser, IUserModel } from "../../Models/User.js";
import { Home } from "../../Models/Home.js";
import redis from "../../redis.js";
import path from "path";
import fs from "fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { replyError } from "../../utils/messages/replyError.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, pyecoin } from "../../utils/constants.js";
import { fileURLToPath } from "url";
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { ExtendedClient } from "../../client.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
	group: "🏦 - Finanzas del server (Casino)",
	data: new SlashCommandBuilder()
		.setName("balance")
		.setDescription("Consulta el dinero que tienes.")
		.addUserOption((option) => option.setName("usuario").setDescription("Selecciona el usuario").setRequired(false)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), deferInteraction()],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const userOption = await interaction.options.getUser("usuario");
			let member: GuildMember | undefined = undefined;

			if (userOption) {
				if (userOption.bot) return await replyWarning(interaction, "No puedo mostrar el balance de bots.");

				member = await interaction.guild?.members.fetch(userOption.id).catch(() => interaction.member as GuildMember);
			}
			member = member || (interaction.member as GuildMember);

			const position = await redis.sendCommand(["ZREVRANK", "top:all", member.id]).then((res) => Number(res?.toString()));
			const data: IUserModel = await getOrCreateUser(member.id);

			let embed = new EmbedBuilder()
				.setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
				.setDescription(
					data.profile ? `🛠 **Oficio**: \`${data.profile.job}\`` : `⚠ Aún no te creaste un perfil, crea uno con \`/start\`.`
				)
				.setFields([
					{ name: "PyE Coins", value: `${pyecoin} ${data.cash?.toLocaleString()}`, inline: true },
					{ name: "Banco", value: `${pyecoin} ${data.bank?.toLocaleString()}`, inline: true },
					{ name: "Total", value: `${pyecoin} ${data.total?.toLocaleString()}`, inline: true },
				])
				.setColor(COLORS.pyeLightBlue)
				.setFooter({ text: `Top: ${!isNaN(position) ? "#" + (position + 1) : "Sin top."}` });
			let attachment: AttachmentBuilder[] | undefined = undefined;

			if (data.profile) {
				const homeData = await Home.findOne({ id: member.id });
				if (!homeData) return await replyError(interaction, "No se pudo encontrar la información de la casa del usuario.");

				let imagePath = `../../assets/Pictures/Profiles/Casa/${homeData.house.color}/${homeData.house.level}.png`;

				if (homeData.pet !== "none") {
					const petDir = path.join(__dirname, `../../assets/Pictures/Profiles/Casa/${homeData.house.color}/${homeData.house.level}`);
					const pets = await fs.readdir(petDir);
					const happyPets = pets.filter((m) => m.includes("Feliz"));
					const selectedPet = happyPets.find((r) => r.includes(homeData.pet));
					if (selectedPet)
						imagePath = `../../assets/Pictures/Profiles/Casa/${homeData.house.color}/${homeData.house.level}/${selectedPet}`;
				}

				const canvas = createCanvas(590, 458);
				const ctx = canvas.getContext("2d");
				const img = await loadImage(path.resolve(__dirname, imagePath));
				ctx.drawImage(img, 0, 0, 590, 458);
				embed.setThumbnail("attachment://casa.png");
				attachment = [new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "casa.png" })];
			}
			return await replyOk(interaction, [embed], undefined, undefined, attachment);
		},
		[]
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"balance",
			[
				{
					name: "usuario",
					required: false,
				},
			],
			["bal"]
		),
} as Command;
