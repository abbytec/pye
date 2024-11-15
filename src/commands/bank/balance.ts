import { ChatInputCommandInteraction, SlashCommandBuilder, GuildMember, AttachmentBuilder, EmbedBuilder } from "discord.js";
import { Users } from "../../Models/User.ts";
import { Home } from "../../Models/Home.ts";
import redis from "../../redis.ts";
import path from "path";
import fs from "fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyError } from "../../utils/messages/replyError.ts"; // Asegúrate de tener estas funciones adaptadas
import { PostHandleable } from "../../types/middleware.ts";
import { pyecoin } from "../../utils/constants.ts";
import { IUser } from "../../interfaces/IUser.ts";
import { fileURLToPath } from "url";
import { replyWarning } from "../../utils/messages/replyWarning.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";

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
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const userOption = interaction.options.getUser("usuario");
			let member: GuildMember | undefined = undefined;

			if (userOption) {
				if (userOption.bot) return await replyWarning(interaction, "No puedo mostrar el balance de bots.");

				member = await interaction.guild?.members.fetch(userOption.id).catch(() => interaction.member as GuildMember);
			}
			member = member || (interaction.member as GuildMember);

			const position = await redis.sendCommand(["ZREVRANK", "top:all", member.id]).then((res) => Number(res?.toString()));
			const data: Partial<IUser> = (await Users.findOne({ id: member.id }).exec()) ?? { cash: 0, bank: 0, total: 0 };

			if (!data) return await replyError(interaction, "No se pudo encontrar la información del usuario.");

			let embed = new EmbedBuilder()
				.setAuthor({ name: member.user.username, iconURL: member.user.displayAvatarURL() })
				.setDescription(data.profile ? `**Oficio**: \`${data.profile.job}\`` : `⚠ Aún no te creaste un perfil, crea uno con \`/start\`.`)
				.setFields([
					{ name: "PyE Coins", value: `${pyecoin} ${data.cash?.toLocaleString()}`, inline: true },
					{ name: "Banco", value: `${pyecoin} ${data.bank?.toLocaleString()}`, inline: true },
					{ name: "Total", value: `${pyecoin} ${data.total?.toLocaleString()}`, inline: true },
				])
				.setFooter({ text: `Top: ${!isNaN(position) ? "#" + (position + 1) : "Sin top."}` });
			let attachment: AttachmentBuilder[] | undefined = undefined;

			if (data.profile) {
				const homeData = await Home.findOne({ id: member.id }).exec();
				if (!homeData) return await replyError(interaction, "No se pudo encontrar la información de la casa del usuario.");

				let imagePath = `../../utils/Pictures/Profiles/Casa/${homeData.house.color}/${homeData.house.level}.png`;

				if (homeData.pet !== "none") {
					const petDir = path.join(__dirname, `../../utils/Pictures/Profiles/Casa/${homeData.house.color}/${homeData.house.level}`);
					const pets = await fs.readdir(petDir);
					const happyPets = pets.filter((m) => m.includes("Feliz"));
					const selectedPet = happyPets.find((r) => r.includes(homeData.pet));
					if (selectedPet)
						imagePath = `../../utils/Pictures/Profiles/Casa/${homeData.house.color}/${homeData.house.level}/${selectedPet}`;
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
};
