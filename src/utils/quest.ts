// src/utils/checkQuestLevel.ts
import { Home, levelUpHome } from "../Models/Home.js";
import { Users } from "../Models/User.js";
import { readdirSync } from "fs";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import path, { dirname } from "path";
import {
	ActionRowBuilder,
	AttachmentBuilder,
	ButtonBuilder,
	EmbedBuilder,
	StringSelectMenuBuilder,
	TextChannel,
	MessageCreateOptions,
	StringSelectMenuInteraction,
	Guild,
	Message,
	InteractionResponse,
	MessageFlags,
} from "discord.js";
import { COLORS, getChannelFromEnv } from "./constants.js";
import { fileURLToPath } from "node:url";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";
import { levels, LevelConfig } from "./levelsconfig.js";

const Choose = new Set();
const __dirname = dirname(fileURLToPath(import.meta.url));

export interface IQuest {
	msg: IPrefixChatInputCommand | Message | InteractionResponse;
	money?: number;
	bump?: number;
	text?: number;
	rep?: number;
	userId: string;
}

export async function checkQuestLevel({ msg, money, bump, text, rep, userId }: IQuest, game = false) {
	const user = await Home.findOne({ id: userId, active: true }).catch(() => null);
	if (!user) return;
	const dateZ = await Users.findOne({ id: userId }).catch(() => null);
	const person = msg.client.users.resolve(userId);
	if (!person) return;

	let guild: Guild | null = null;
	let channelId: string = "";
	if ("interaction" in msg && msg.interaction && "guildId" in msg.interaction && msg.interaction.channelId) {
		guild = msg.client?.guilds.cache.get(process.env.GUILD_ID ?? "") ?? msg.client?.guilds.resolve(process.env.GUILD_ID ?? "");
		channelId = msg.interaction.channelId ?? "";
	} else if ("guild" in msg && msg.guild) {
		guild = msg.guild;
		channelId = msg.channelId ?? "";
	}

	const currentLevel = user.house.level;
	const levelConfig = levels.find((l: LevelConfig) => l.level === currentLevel);
	if (!levelConfig) return;

	// Si el nivel requiere que el dinero provenga de juegos
	if (levelConfig.game && !game) return;

	// Actualizar el progreso
	if (money) user.money += money;
	if (bump) user.bump += bump;
	if (text) user.text += text;
	if (rep) user.rep += rep;
	await user.save();

	// Verificar si se cumplen los requisitos
	const req = levelConfig.requirements;
	const progressMet =
		(!req.money || user.money >= req.money()) &&
		(!req.bump || user.bump >= req.bump) &&
		(!req.text || user.text >= req.text) &&
		(!req.rep || user.rep >= req.rep);

	if (!progressMet) return;

	// Si existe recompensa interactiva, se activa el proceso correspondiente
	if (levelConfig.interactiveReward) {
		if (channelId !== getChannelFromEnv("general") || channelId !== getChannelFromEnv("casinoPye"))
			channelId = getChannelFromEnv("casinoPye");
		if (levelConfig.interactiveReward.type === "color") {
			if (Choose.has(person.id)) return;
			const casas = readdirSync(path.join(__dirname, "../assets/Pictures/Profiles/Casa"));
			const rutasCasas: string[] = [];
			for (const Color of casas) {
				rutasCasas.push(path.join(__dirname, `../assets/Pictures/Profiles/Casa/${Color}/${2}.png`));
			}
			let page = 0;
			const all = rutasCasas.length;
			const contenido = async (disable = false): Promise<MessageCreateOptions> => {
				const canvas = createCanvas(470, 708);
				const ctx = canvas.getContext("2d");
				const img = await loadImage(rutasCasas[page]);
				ctx.drawImage(img, 0, 0, 470, 708);
				const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "casa.png" });
				return {
					content: `<@${userId}>`,
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: person.tag, iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido de nivel y ahora puedes escoger un color para tu casa.`)
							.addFields([{ name: "Color", value: `Este es el color ${casas[page]}` }])
							.setImage("attachment://casa.png")
							.setFooter({ text: "Tienes 4 minutos para responder, usa las flechas para cambiar de imagen." }),
					],
					components: [
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							new ButtonBuilder()
								.setStyle(1)
								.setLabel("«")
								.setCustomId("backS")
								.setDisabled(page - 1 < 0),
							new ButtonBuilder()
								.setStyle(1)
								.setLabel("»")
								.setCustomId("nextS")
								.setDisabled(page + 1 >= all)
						),
						new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
							new StringSelectMenuBuilder()
								.addOptions([
									{ label: "Blanco", value: "Blanco", emoji: "🤍" },
									{ label: "Naranja", value: "Naranja", emoji: "🧡" },
									{ label: "Rosa", value: "Rosa", emoji: "💗" },
									{ label: "Verde", value: "Verde", emoji: "💚" },
								])
								.setCustomId("color")
								.setPlaceholder("Selecciona el color de tu casa.")
						),
					],
					files: [attachment],
				};
			};
			Choose.add(person.id);
			let m = await (guild?.channels.resolve(channelId) as TextChannel | null)?.send(await contenido());
			m?.createMessageComponentCollector({
				filter: (i: any) => i.user.id === person.id && ["nextS", "backS"].includes(i.customId),
				time: 60e3,
			})
				.on("collect", async (i: any) => {
					if (i.customId === "backS" && page > 0) page--;
					else if (i.customId === "nextS" && page < all - 1) page++;
					else i.deferUpdate();
					i.update(await contenido());
				})
				.on("end", async () => m.edit({ components: [] }).catch(() => null));

			const res = (await m
				?.awaitMessageComponent({
					filter: (i: any) => i.user.id === person.id && ["color"].includes(i.customId),
					time: 240e3,
				})
				.catch(() => null)) as StringSelectMenuInteraction | null;
			if (!res) {
				m?.edit({
					embeds: [new EmbedBuilder().setDescription("<:cross:1282933529566511155> - Se acabó el tiempo...").setColor(COLORS.errRed)],
					components: [],
					files: [],
				}).catch(() => null);
				Choose.delete(person.id);
				return await user.updateOne({ money: 0, active: false });
			}
			res.update({
				embeds: [
					new EmbedBuilder()
						.setAuthor({ name: person.tag, iconURL: person.displayAvatarURL() })
						.setDescription(`🏠 - Las paredes han sido pintadas de color \`${res.values[0]}\`.`)
						.setTimestamp(),
				],
				files: [],
				components: [],
			});
			let next = dateZ && ["Obrero", "Obrera"].includes(dateZ.profile?.job ?? "") ? 3 : 1;
			return await levelUpHome(user, next, res.values[0]);
		} else if (levelConfig.interactiveReward.type === "pet") {
			if (Choose.has(person.id)) return false;
			const mascotas = readdirSync(path.join(__dirname, `../assets/Pictures/Profiles/Casa/${user.house.color}/${user.house.level + 1}`));
			const rutasPets = mascotas.filter((m) => m.includes("Feliz"));
			let page = 0;
			const all = rutasPets.length;
			const contenido = async (disable = false): Promise<MessageCreateOptions> => {
				const canvas = createCanvas(670, 408);
				const ctx = canvas.getContext("2d");
				const img = await loadImage(
					path.join(__dirname, `../assets/Pictures/Profiles/Casa/${user.house.color}/${user.house.level + 1}/${rutasPets[page]}`)
				);
				ctx.drawImage(img, 0, 0, 670, 408);
				const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "mascota.png" });
				return {
					content: `<@${person.id}>`,
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido de nivel y ahora puedes escoger una mascota para tu casa.`)
							.addFields([{ name: "Mascota", value: `${rutasPets[page].split(/(?=[A-Z])/)[2]}` }])
							.setImage("attachment://mascota.png")
							.setFooter({ text: "Tienes 4 minutos para responder, usa las flechas para cambiar de imagen." }),
					],
					components: [
						new ActionRowBuilder<ButtonBuilder>().addComponents(
							new ButtonBuilder()
								.setStyle(1)
								.setLabel("«")
								.setCustomId("backS")
								.setDisabled(page - 1 < 0),
							new ButtonBuilder()
								.setStyle(1)
								.setLabel("»")
								.setCustomId("nextS")
								.setDisabled(page + 1 >= all)
						),
						new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
							new StringSelectMenuBuilder()
								.addOptions([
									{ label: "Cocodrilo", value: "Cocodrilo", emoji: "🐊" },
									{ label: "Dragon", value: "Dragon", emoji: "🐉" },
									{ label: "Gato", value: "Gato", emoji: "🐈" },
									{ label: "Mono", value: "Mono", emoji: "🐒" },
									{ label: "Perro", value: "Perro", emoji: "🐕" },
								])
								.setCustomId("pet")
								.setPlaceholder("Selecciona tu mascota !")
						),
					],
					files: [attachment],
				};
			};
			Choose.add(person.id);
			let m = await (guild?.channels.resolve(channelId) as TextChannel | null)?.send(await contenido());
			m?.createMessageComponentCollector({
				filter: (i: any) => i.user.id === person.id && ["nextS", "backS"].includes(i.customId),
				time: 60e3,
			})
				.on("collect", async (i: any) => {
					if (i.customId === "backS" && page > 0) page--;
					else if (i.customId === "nextS" && page < all - 1) page++;
					else i.deferUpdate();
					i.update(await contenido());
				})
				.on("end", async () => m?.edit({ components: [] }).catch(() => null));

			const res = (await m
				?.awaitMessageComponent({
					filter: (i: any) => i.user.id === person.id && ["pet"].includes(i.customId),
					time: 240e3,
				})
				.catch(() => null)) as StringSelectMenuInteraction | null;
			if (!res) {
				m?.edit({
					embeds: [new EmbedBuilder().setDescription("<:cross:1282933529566511155> - Se acabó el tiempo...").setColor(COLORS.errRed)],
					components: [],
					files: [],
				}).catch(() => null);
				Choose.delete(person.id);
				return await user.updateOne({ text: 0, active: false });
			}
			const pet = res.values[0];
			res.update({
				embeds: [
					new EmbedBuilder()
						.setAuthor({ name: person.tag, iconURL: person.displayAvatarURL() })
						.setDescription(`<:cross:1282933529566511155> - **${person.username}** ha escogido el \`${pet}\` para su casa.`)
						.setTimestamp(),
				],
				files: [],
				components: [],
			});
			(guild?.channels.resolve(channelId) as TextChannel)?.send({
				embeds: [
					new EmbedBuilder()
						.setTitle("Mini tutorial de mascotas !")
						.setDescription(
							`❥ \`!pet show\` - Muestra a tu mascota.\n❥ \`!pet play\` - Juega con tu mascota.\n❥ \`!pet clean\` - Limpia a tu mascota.\n❥ \`!pet feed\` - Alimenta a tu mascota.\n❥ \`!pet name\` - Cambia el nombre de tu mascota.\nTodos estos ítems puedes conseguirlos en la tienda.`
						)
						.addFields([{ name: "¡No olvides!", value: "Si tu mascota se escapa, vuelves al nivel 12." }])
						.setThumbnail("https://cdn.discordapp.com/emojis/1008539448637665300.png?size=96")
						.setTimestamp(),
				],
			});
			return await user.updateOne(
				{
					level: user.level + 1,
					pet: pet,
					house: {
						level: user.house.level + 1,
						color: user.house.color,
					},
				},
				{ upsert: true }
			);
		}
	}

	// Sin recompensa interactiva: se envía el mensaje de nivelación
	if (guild && channelId) {
		const embed = levelConfig.levelUpEmbed
			? levelConfig.levelUpEmbed(person.username, currentLevel + 1)
			: new EmbedBuilder().setDescription(`\`${person.username}\` ha subido al nivel: \`${currentLevel + 1}\``).setTimestamp();
		(guild.channels.resolve(channelId) as TextChannel)?.send({
			content: `<@${person.id}>`,
			embeds: [embed],
			flags: MessageFlags.SuppressNotifications,
		});
	}
	return await levelUpHome(user, 1);
}
