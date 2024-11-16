// home.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, GuildMember, User, APIUser } from "discord.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { replyWarning } from "../../utils/messages/replyWarning.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";

import path from "path";
import fs from "fs/promises";
import { createCanvas, loadImage } from "@napi-rs/canvas";

import { Home, IHomeDocument } from "../../Models/Home.ts";
import { Users } from "../../Models/User.ts";
import { Pets } from "../../Models/Pets.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { getChannelFromEnv } from "../../utils/constants.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";

const jobs: Record<string, string> = {
	Policia:
		"Atrapa a los usuarios con la profesión de ladrón usando !cap. Les quita lo robado, pero solo puede usarse si alguien ha robado en los últimos 30 segundos.",
	Militar:
		"Atrapa a los usuarios con la profesión de ladrón usando !cap. Les quita lo robado, pero solo puede usarse si alguien ha robado en los últimos 60 segundos. Puede fallar!",
	Bombero: "+35% de ganancias en los juegos.",
	Bombera: "+35% de ganancias en los juegos.",
	Enfermero: "+50% de ganancias en los comandos si está casado con una Doctora.",
	Enfermera: "+50% de ganancias en los comandos si está casado con un Doctor.",
	Doctor: "+50% de ganancias en los comandos si está casado con una Enfermera.",
	Doctora: "+50% de ganancias en los comandos si está casado con un Enfermero.",
	Ladron: "Menos tiempo de espera para usar el comando !rob. Nunca falla sus robos.",
	Ladrona: "Menos tiempo de espera para usar el comando !rob. Nunca falla sus robos.",
	Obrero: "Los primeros 2 niveles de tu casa son gratis.",
	Obrera: "Los primeros 2 niveles de tu casa son gratis.",
};

export default {
	group: "👤 - Perfiles (Casino)",
	data: new SlashCommandBuilder()
		.setName("home")
		.setDescription("Mira cómo se ve tu casa.")
		.addUserOption((option) => option.setName("usuario").setDescription("El usuario cuya casa deseas ver").setRequired(false))
		.addStringOption((option) => option.setName("nombre").setDescription("Establece el nombre de tu casa").setRequired(false)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const option = interaction.options.getUser("usuario");
			const nameOption = interaction.options.getString("nombre");

			const member: GuildMember = option
				? (await interaction.guild?.members.fetch(option.id).catch(() => null)) || (interaction.member as GuildMember)
				: (interaction.member as GuildMember);

			if (member.user.bot) return replyError(interaction, "Los bots no pueden tener una casa.");

			const home = await Home.findOne({ id: member.id });

			if (interaction.member?.user.id === member.id) {
				if (!home) return replyWarning(interaction, "Aún no tienes un perfil de economía.");
				if (nameOption) {
					home.name = nameOption.slice(0, 60); // Limitar a 60 caracteres
					await home.save();

					return replyOk(interaction, "El nombre de tu casa ha sido cambiado.");
				}
			} else if (!home) return replyWarning(interaction, "Aún no tiene un perfil de economía.");
			else if (nameOption) return replyError(interaction, "No puedes cambiar el nombre de la casa de alguien mas.");

			const user = await Users.findOne({ id: member.id });

			// Generar la imagen de la casa
			const attachment = await getHouseImage(home);

			// Construir el embed
			const embed = new EmbedBuilder()
				.setTitle(`${member.user.username}'s house`)
				.setDescription(home.name ? home.name : `🏠 Casa de ${member.user.username}`)
				.setThumbnail(member.user.displayAvatarURL())
				.addFields(
					{ name: "Dueño", value: `\`${member.user.tag}\``, inline: true },
					{ name: "Nivel", value: `Esta casa es nivel: \`${home.house.level}\``, inline: true },
					{ name: "📝 Sobre su oficio", value: user?.profile?.job ? jobs[user?.profile?.job] : "Sin info" }
				)
				.setImage("attachment://casa.png")
				.setTimestamp();

			return replyOk(interaction, [embed], undefined, undefined, [attachment]);
		},
		[]
	),
};
async function getHouseImage(data: IHomeDocument): Promise<AttachmentBuilder> {
	let imagePath = path.join(process.cwd(), "src", "utils", "Pictures", "Profiles", "Casa", data.house.color, `${data.house.level}.png`);

	if (data.pet !== "none") {
		let petInfo = (await Pets.findOne({ id: data.id })) ?? (await Pets.create({ id: data.id }));

		const houseDir = path.join(process.cwd(), "src", "utils", "Pictures", "Profiles", "Casa", data.house.color, `${data.house.level}`);
		const files = await fs.readdir(houseDir);
		const mood = getMood(petInfo);
		const petFiles = files.filter((file) => file.includes(mood) && file.includes(data.pet));

		if (petFiles.length > 0) imagePath = path.join(houseDir, petFiles[0]);
	}

	const canvas = createCanvas(590, 458);
	const ctx = canvas.getContext("2d");
	const img = await loadImage(imagePath);
	ctx.drawImage(img, 0, 0, 590, 458);
	return new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "casa.png" });
}

function getMood({ food, mood, shower }: { food: number; mood: number; shower: number }): string {
	if (mood <= 40 && food <= 40 && shower <= 40) return "Enojado";
	else return "Feliz";
}
