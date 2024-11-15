// profile.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { newUser, Users } from "../../Models/User.ts";
import { HelperPoint, IHelperPointDocument } from "../../Models/HelperPoint.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { getChannelFromEnv, pyecoin } from "../../utils/constants.ts";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs/promises"; // Usar promesas para operaciones de archivos
import redisClient from "../../redis.ts"; // Asegúrate de exportar correctamente tu cliente redis
import { replyWarning } from "../../utils/messages/replyWarning.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { verifyChannel } from "../../utils/middlewares/verifyIsChannel.ts";

const jobs: Record<string, string> = {
	Policia:
		"Atrapa a los usuarios con la profesión de ladrón usando !cap. Les quita lo robado, pero solo puede usarse si alguien ha robado en los últimos 30 segundos.",
	Militar:
		"Atrapa a los usuarios con la profesión de ladrón usando !cap. Les quita lo robado, pero solo puede usarse si alguien ha robado en los últimos 60 segundos. Puede fallar!",
	Bombero: "+35% de ganancias en los juegos.",
	Bombera: "+35% de ganancias en los juegos.",
	Enfermero: "+50% de ganancias en los comandos si esta casado con una Doctora.",
	Enfermera: "+50% de ganancias en los comandos si esta casado con un Doctor.",
	Doctor: "+50% de ganancias en los comandos si esta casado con una Enfermera.",
	Doctora: "+50% de ganancias en los comandos si esta casado con un Enfermero.",
	Ladron: "Menos tiempo de espera para usar el comando !rob. Nunca falla sus robos.",
	Ladrona: "Menos tiempo de espera para usar el comando !rob. Nunca falla sus robos.",
	Obrero: "Los primeros 2 niveles de tu casa son gratis.",
	Obrera: "Los primeros 2 niveles de tu casa son gratis.",
};

export default {
	group: "👤 - Perfiles (Casino)",
	data: new SlashCommandBuilder()
		.setName("profile")
		.setDescription("Muestra tu perfil o el de otra persona en la economía.")
		.addUserOption((option) => option.setName("usuario").setDescription("El usuario cuyo perfil deseas ver").setRequired(false))
		.addStringOption((option) => option.setName("descripcion").setDescription("Actualiza tu descripción de perfil").setRequired(false)),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const author = interaction.user;
			const option = interaction.options.getUser("usuario");
			const descriptionOption = interaction.options.getString("descripcion");

			const member = option
				? (await interaction.guild?.members.fetch(option.id).catch(() => null)) || interaction.member
				: (interaction.member as any); // Asegúrate de manejar correctamente el tipo

			if (member.user.bot) return replyWarning(interaction, "Los bots no pueden tener un perfil.");

			let userData = await Users.findOne({ id: member.id });
			if (!userData) userData = await newUser(member.id);

			if (descriptionOption) {
				// Actualizar descripción si se proporciona
				userData.description = descriptionOption.slice(0, 110); // Limitar a 110 caracteres
				await userData.save();
				return replyOk(interaction, "📝 Descripción actualizada exitosamente.");
			}

			if (!userData.profile)
				return replyWarning(
					interaction,
					member.id === author.id
						? `⚠ Aún no tienes un perfil, crea uno con \`/start\`.`
						: `⚠ ${member.user.username} aún no tiene un perfil, puede crear uno con \`/start\`.`
				);

			const position = await redisClient.zRevRank("top:all", member.id);
			let dataRep: Partial<IHelperPointDocument> | null = await HelperPoint.findOne({ _id: member.id }).exec();
			const people = await HelperPoint.find().sort({ points: -1 }).exec();
			if (!dataRep) dataRep = { points: 0 };
			const img = await getJobImage(userData.profile);
			const rank = people.findIndex((u) => u._id === member.id) + 1;

			const embed = new EmbedBuilder()
				.setAuthor({
					name: `${member.user.username}'s profile`,
					iconURL: member.user.displayAvatarURL(),
				})
				.setThumbnail("attachment://estilo.png")
				.setDescription(userData.description || "Mirame soy una linda mariposa. 🦋")
				.addFields(
					{ name: "🛠 Oficio", value: userData.profile.job || "No tiene oficio.", inline: true },
					{
						name: "🏆 Tops",
						value:
							"**Cash:** " + (position ? `#${position + 1}` : "Sin top.") + "\n**Rep:** " + (rank === 0 ? "Sin top." : `#${rank}`),
						inline: true,
					},
					{
						name: "💍 Pareja(s)",
						value: userData.couples?.length ? await getCouplesList(interaction, userData.couples) : "No tiene.",
						inline: true,
					},
					{
						name: "💳 Cartera",
						value: `**PyE Coins:** \`${userData.cash.toLocaleString()}\` ${pyecoin}\n**Banco:** \`${userData.bank.toLocaleString()}\` ${pyecoin}\n**Total:** \`${userData.total.toLocaleString()}\` ${pyecoin}`,
						inline: true,
					},
					{
						name: "🌠 Stats",
						value: `🎒 **Inventario:** ${userData.inventory.length}\n<:pyestar:926334569903435776> **Reputación:** ${dataRep.points}`,
						inline: true,
					},
					{
						name: "📝 Sobre su oficio",
						value: jobs[userData.profile.job] || "Sin info",
						inline: true,
					}
				)
				.setFooter({
					text: `Pedido por ${author.tag}`,
					iconURL: author.displayAvatarURL(),
				})
				.setTimestamp()
				.setColor(0xebae34);

			return replyOk(interaction, [embed], undefined, undefined, [img]);
		},
		[]
	),
};

// Función para obtener la lista de parejas formateada
async function getCouplesList(interaction: ChatInputCommandInteraction, couples: Array<{ user: string }>): Promise<string> {
	const formattedCouples = await Promise.all(
		couples.map(async (u) => {
			const member = await interaction.guild?.members.fetch(u.user).catch(() => null);
			return member ? `• [\`${member.user.username}\`](https://discord.com/users/${u.user})` : `• \`ID: ${u.user}\``;
		})
	);
	return formattedCouples.join("\n") || "No hay usuarios en el top.";
}

// Función para obtener la imagen del trabajo
async function getJobImage(profile: any): Promise<AttachmentBuilder> {
	const job = profile.job;
	const sex = profile.gender;
	const skin = profile.skin;
	const styleIndex = Number(profile.style) - 1 || 0;

	const stylesPath = path.resolve(process.cwd(), "src", "utils", "Pictures", "Profiles", sex, skin);
	const styles = await fs.readdir(stylesPath);
	const imagePath = path.join(stylesPath, styles[styleIndex] || styles[0], `${job}.png`);

	try {
		await fs.access(imagePath);
	} catch {
		return new AttachmentBuilder(path.join(stylesPath, styles[0], "default.png"), { name: "estilo.png" });
	}

	const canvas = createCanvas(470, 708);
	const ctx = canvas.getContext("2d");
	const img = await loadImage(imagePath);
	ctx.drawImage(img, 0, 0, 470, 708);
	return new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "estilo.png" });
}
