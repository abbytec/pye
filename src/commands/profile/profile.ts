// profile.ts

import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder } from "discord.js";
import { getOrCreateUser } from "../../Models/User.js";
import { HelperPoint, IHelperPointDocument } from "../../Models/HelperPoint.js";
import { composeMiddlewares } from "../../composables/composeMiddlewares.js";
import { verifyIsGuild } from "../../composables/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../composables/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { COLORS, getChannelFromEnv, pyecoin } from "../../utils/constants.js";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import fs from "fs/promises"; // Usar promesas para operaciones de archivos
import redisClient from "../../redis.js"; // Asegúrate de exportar correctamente tu cliente redis
import { replyWarning } from "../../utils/messages/replyWarning.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { verifyChannel } from "../../composables/middlewares/verifyIsChannel.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { ExtendedClient } from "../../client.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";

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
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyChannel(getChannelFromEnv("casinoPye")), deferInteraction(false)],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const author = interaction.user;
			const option = await interaction.options.getUser("usuario");
			const descriptionOption = interaction.options.getString("descripcion");

			const member = option
				? (await interaction.guild?.members.fetch(option.id).catch(() => null)) || interaction.member
				: (interaction.member as any);

			if (member.user.bot) return replyWarning(interaction, "Los bots no pueden tener un perfil.");

			const userData = await getOrCreateUser(member.id);

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
						? `Aún no tienes un perfil, crea uno con \`/start\`.`
						: `${member.user.username} aún no tiene un perfil, puede crear uno con \`/start\`.`
				);

			const position = await redisClient.zRevRank("top:all", member.id);
			const dataRep: IHelperPointDocument | null = await HelperPoint.findOne({ _id: member.id });
			const people = await HelperPoint.find().sort({ points: -1 });
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
						value: `🎒 **Inventario:** ${userData.inventory.length}\n<:pyestar:1313345160549105774> **Reputación:** ${
							dataRep?.points ?? 0
						}`,
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
				.setColor(COLORS.pyeLightBlue);

			return replyOk(interaction, [embed], undefined, undefined, [img]);
		},
		[]
	),
	prefixResolver: (client: ExtendedClient) =>
		new PrefixChatInputCommand(
			client,
			"profile",
			[
				{
					name: "usuario",
					required: false,
				},
				{
					name: "descripcion",
					required: false,
				},
			],
			["perfil"]
		),
} as Command;

// Función para obtener la lista de parejas formateada
async function getCouplesList(interaction: IPrefixChatInputCommand, couples: Array<{ user: string }>): Promise<string> {
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
	const skin = profile.skin === "Normal" ? "Intermedio" : profile.skin;
	const styleIndex = Number(profile.style) - 1 || 0;

	const stylesPath = path.resolve(process.cwd(), "src", "assets", "Pictures", "Profiles", sex, skin);
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
