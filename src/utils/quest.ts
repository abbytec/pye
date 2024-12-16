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
	ChatInputCommandInteraction,
	TextChannel,
	MessageCreateOptions,
	StringSelectMenuInteraction,
	Message,
	InteractionResponse,
	Guild,
} from "discord.js";
import { COLORS } from "./constants.js";
import { fileURLToPath } from "node:url";
import { IPrefixChatInputCommand } from "../interfaces/IPrefixChatInputCommand.js";
const Choose = new Set();

export interface IQuest {
	msg: IPrefixChatInputCommand | Message | InteractionResponse;
	money?: number;
	bump?: number;
	text?: number;
	rep?: number;
	userId: string;
}
const __dirname = dirname(fileURLToPath(import.meta.url));
export async function checkQuestLevel({ msg, money, bump, text, rep, userId }: IQuest, game = false) {
	const user = await Home.findOne({ id: userId, active: true }).catch(() => null);
	if (!user) return;
	const dateZ = await Users.findOne({ id: userId }).catch(() => null);
	let next;
	const person = msg.client.users.resolve(userId);
	if (!person) return;
	let guild: Guild | null = null;
	let channelId: string = "";
	if ("interaction" in msg && msg.interaction && "guildId" in msg.interaction && msg.interaction.channelId) {
		guild =
			msg.client?.guilds.cache.get(msg.interaction.guildId ?? process.env.GUILD_ID ?? "") ??
			msg.client?.guilds.resolve(msg.interaction.guildId ?? process.env.GUILD_ID ?? "");
		channelId = msg.interaction.channelId ?? "";
	} else if ("guild" in msg && msg.guild) {
		guild = msg.guild;
		channelId = msg.channelId ?? "";
	}
	switch (user.house.level) {
		case 1:
			if (!money) return;
			if (Choose.has(person.id)) return;
			if (user.money + money >= 3e3) {
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
								.setDescription(
									`\`${person.username}\` has subido al nivel: \`2\`\nPor lo que ahora puedes escoger un color para la pared de tu casa.`
								)
								.addFields([{ name: "Color", value: `Este es el color ${casas[page]}` }])
								.setImage("attachment://casa.png")
								.setFooter({ text: "Tienes 4 minutos para responder, usas las flechas para cambiar de imagen." }),
						],
						components: [
							new ActionRowBuilder<ButtonBuilder>().addComponents(
								[
									new ButtonBuilder()
										.setStyle(1)
										.setLabel("«")
										.setCustomId("backS")
										.setDisabled(page - 1 < 0),
									new ButtonBuilder()
										.setStyle(1)
										.setLabel("»")
										.setCustomId("nextS")
										.setDisabled(page + 1 >= all),
								].map((b) => (disable ? b.setDisabled(true) : b))
							),
							new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
								new StringSelectMenuBuilder()
									.addOptions([
										{
											label: "Blanco",
											value: "Blanco",
											emoji: "🤍",
										},
										{
											label: "Naranja",
											value: "Naranja",
											emoji: "🧡",
										},
										{
											label: "Rosa",
											value: "Rosa",
											emoji: "💗",
										},
										{
											label: "Verde",
											value: "Verde",
											emoji: "💚",
										},
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
						if (i.customId === "backS" && page >= 0) page--;
						else if (i.customId === "nextS" && page < all) page++;
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
						embeds: [
							new EmbedBuilder().setDescription("<:cross:1282933529566511155> - Se acabó el tiempo...").setColor(COLORS.errRed),
						],
						components: [],
						files: [],
					}).catch(() => null);
					Choose.delete(person.id);
					return await user.updateOne({ money: 0, activate: false });
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
				if (dateZ && ["Obrero", "Obrera"].includes(dateZ.profile?.job ?? "")) next = 3;
				else next = 1;
				return await levelUpHome(user, next, res.values[0]);
			}
			user.money += money;
			await user.save();

			break;
		case 2:
			if (!money) return;
			if (user.money + money >= 10e3) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`3\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.money += money;
			await user.save();
			break;
		case 3:
			if (!game) return;
			if (user.money + (money ?? 0) >= 10e3) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`4\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.money += money ?? 0;
			await user.save();
			break;
		case 4:
			if (!money) money = 0;
			if (!bump) bump = 0;
			if (user.money + money >= 15e3 && user.bump + bump >= 1) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`5\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.money += money;
			user.bump += bump;
			await user.save();

			break;
		case 5:
			if (!text) return;
			if (user.text + text >= 300) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`6\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.text += text;
			await user.save();

			break;
		case 6:
			if (!money) return;
			if (user.money + money >= 30e3) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`7\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.money += money;
			await user.save();

			break;
		case 7:
			if (!game) return;
			if (user.money + (money ?? 0) >= 30e3) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`8\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.money += money ?? 0;
			await user.save();
			break;
		case 8:
			if (!text) return;
			if (user.text + text >= 500) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`9\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.text += text;
			await user.save();
			break;
		case 9:
			if (!money) money = 0;
			if (!bump) bump = 0;
			if (!rep) rep = 0;
			if (user.money + money >= 50e3 && user.bump + bump >= 2 && user.rep + rep >= 1) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`10\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.money += money;
			user.bump += bump;
			user.rep += rep;
			await user.save();
			break;
		case 10:
			if (!game) return;
			if (user.money + (money ?? 0) >= 50e3) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`11\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.money += money ?? 0;
			await user.save();
			break;
		case 11:
			if (!money) money = 0;
			if (!rep) rep = 0;
			if (user.money + money >= 100e3 && user.rep + rep >= 2) {
				(guild?.channels.resolve(channelId) as TextChannel)?.send({
					embeds: [
						new EmbedBuilder()
							.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
							.setDescription(`\`${person.username}\` ha subido al nivel:  \`12\``)
							.setTimestamp(),
					],
				});
				return await levelUpHome(user, 1);
			}
			user.money += money;
			user.rep += rep;
			await user.save();
			break;
		case 12:
			if (!text) return;

			if (user.text + text >= 1e3) {
				if (Choose.has(person.id)) return false;
				const mascotas = readdirSync(
					path.join(__dirname, `../assets/Pictures/Profiles/Casa/${user.house.color}/${user.house.level + 1}`)
				);
				const rutasPets = mascotas.filter((m) => m.includes("Feliz"));

				let page = 0;
				const all = rutasPets.length;
				const contenido = async (disable = false) => {
					const canvas = createCanvas(670, 408);
					const ctx = canvas.getContext("2d");
					const img = await loadImage(
						path.join(__dirname, `../assets/Pictures/Profiles/Casa/${user.house.color}/${user.house.level + 1}/${rutasPets[page]}`)
					);
					ctx.drawImage(img, 0, 0, 670, 408);

					const attachment = new AttachmentBuilder(canvas.toBuffer("image/png"), { name: "mascota.png" });

					return {
						content: `${person.toString()}`,
						embeds: [
							new EmbedBuilder()
								.setAuthor({ name: "🏠 Nuevo nivel en tu casa.", iconURL: person.displayAvatarURL() })
								.setDescription(
									`\`${person.username}\` ha subido al nivel:  \`13\`\nPor lo que ahora puedes escoger una mascota para tu casa.`
								)
								.addFields([{ name: "Mascota", value: `${rutasPets[page].split(/(?=[A-Z])/)[2]}` }])
								.setImage("attachment://mascota.png")
								.setFooter({ text: "Tienes 4 minutos para responder, usas las flechas para cambiar de imagen." }),
						],
						components: [
							new ActionRowBuilder().addComponents(
								[
									new ButtonBuilder()
										.setStyle(1)
										.setLabel("«")
										.setCustomId("backS")
										.setDisabled(page - 1 < 0),
									new ButtonBuilder()
										.setStyle(1)
										.setLabel("»")
										.setCustomId("nextS")
										.setDisabled(page + 1 >= all),
								].map((b) => (disable ? b.setDisabled(true) : b))
							),
							new ActionRowBuilder().addComponents(
								new StringSelectMenuBuilder()
									.addOptions([
										{
											label: "Cocodrilo",
											value: "Cocodrilo",
											emoji: "🐊",
										},
										{
											label: "Dragon",
											value: "Dragon",
											emoji: "🐉",
										},
										{
											label: "Gato",
											value: "Gato",
											emoji: "🐈",
										},
										{
											label: "Mono",
											value: "Mono",
											emoji: "🐒",
										},
										{
											label: "Perro",
											value: "Perro",
											emoji: "🐕",
										},
									])
									.setCustomId("pet")
									.setPlaceholder("Selecciona tu mascota !")
							),
						],
						files: [attachment],
					};
				};
				Choose.add(person.id);
				//error de permisos en esta linea
				let m = await (guild?.channels.resolve(channelId) as TextChannel)?.send((await contenido()) as MessageCreateOptions);
				m.createMessageComponentCollector({
					filter: (i: any) => i.user.id === person.id && ["nextS", "backS"].includes(i.customId),
					time: 60e3,
				})
					.on("collect", async (i: any) => {
						if (i.customId === "backS" && page >= 0) page--;
						else if (i.customId === "nextS" && page < all) page++;
						else i.deferUpdate();
						i.update(await contenido());
					})
					.on("end", async () => m.edit({ components: [] }).catch(() => null));

				const res = (await m
					.awaitMessageComponent({
						filter: (i: any) => i.user.id === person.id && ["pet"].includes(i.customId),
						time: 240e3,
					})
					.catch(() => null)) as StringSelectMenuInteraction | null;
				if (!res) {
					m.edit({
						embeds: [
							new EmbedBuilder().setDescription("<:cross:1282933529566511155> - Se acabó el tiempo...").setColor(COLORS.errRed),
						],
						components: [],
						files: [],
					}).catch(() => null);
					Choose.delete(person.id);
					return await user.updateOne({ text: 0, activate: false });
				}
				let pet = res.values[0];
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
								`❥ \`!pet\` - Muestra a tu mascota.
             \n❥ \`!pet play\` - Te permite subir el cariño de tu mascota y para poder para hacer uso del comando necesitaras :pelota: pelotas para jugar con tu mascota en el inventario.
             \n❥ \`!pet clean\` - Te permite subir el higiene de tu mascota y para poder para hacer uso del comando necesitaras :petfood: shampoo  para bañarlo en tu inventario.
             \n❥ \`!pet feed\` - Te permite disminuir el hambre  de tu mascota y para poder para hacer uso del comando necesitaras :shampoo: alimento.
             \n❥ \`!pet name\` - Te permitirá cambiar el nombre a tu mascota.
             \nTodos estos ítems mencionados los puedes conseguir en la tienda.`
							)
							.addFields([{ name: "¡No olvides!", value: "Si tu mascota se escapa vuelves al nivel 12." }])
							.setThumbnail("https://cdn.discordapp.com/emojis/1008539448637665300.png?size=96")
							.setTimestamp(),
					],
					files: [],
					components: [],
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
			user.text += text;
			await user.save();
			break;
		default:
			return false;
	}
}
