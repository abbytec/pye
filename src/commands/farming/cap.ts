// src/commands/Currency/cap.ts

import { ChatInputCommandInteraction, SlashCommandBuilder, EmbedBuilder, GuildMember, Guild } from "discord.js";
import { newUser, Users } from "../../Models/User.ts";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.ts";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.ts";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.ts";
import { PostHandleable } from "../../types/middleware.ts";
import { replyOk } from "../../utils/messages/replyOk.ts";
import { replyError } from "../../utils/messages/replyError.ts";
import { IUser } from "../../interfaces/IUser.ts";
import { checkQuestLevel, IQuest } from "../../utils/quest.ts";
import { setCooldown } from "../../utils/cooldowns.ts";
import { ExtendedClient } from "../../client.ts";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.ts";
import { Rob } from "./rob.ts";

const cooldownDuration = 2 * 60 * 60 * 1000;

const policeReactionTime = 3e4;
const militarReactionTime = 6e4;

export default {
	data: new SlashCommandBuilder().setName("cap").setDescription("Es como el rob, pero le quitas a los rateros."),

	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("cap", 2 * 60 * 60 * 1000), deferInteraction()],
		async (interaction: ChatInputCommandInteraction): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener datos del usuario
			let userData: Partial<IUser> | null = await Users.findOne({ id: user.id }).exec();
			if (!userData) userData = await newUser(user.id);

			// Verificar que el usuario tenga perfil y trabajo adecuado
			if (!userData.profile || !["Militar", "Policia"].includes(userData.profile.job))
				return await replyError(interaction, "No estás autorizado para usar este comando.");

			const client = interaction.client as ExtendedClient;
			const guild = interaction.guild as Guild;
			let reactionTime = 0;
			if (userData.profile.job === "Policia") reactionTime = policeReactionTime;
			if (userData.profile.job === "Militar") reactionTime = militarReactionTime;

			let entries: Rob[] = [];
			if (reactionTime > 0) {
				entries =
					client.lastRobs.filter((rob) => rob.lastTime > Date.now() - reactionTime).sort((a, b) => b.lastTime - a.lastTime) ?? [];
				if (entries.length === 0) return await replyError(interaction, "No ha habido ningún robo reciente.");
			} else {
				return await replyError(interaction, "No estás autorizado para usar este comando.");
			}

			const { userId: robberId, amount } = entries[0];
			const member = await guild.members.fetch(robberId).catch(() => null as GuildMember | null);

			if (!member) return await replyError(interaction, "El último usuario en robar ya no se encuentra en el servidor.");

			let robberData: IUser | null = await Users.findOne({ id: robberId }).exec();
			if (!robberData) return await replyError(interaction, "No se pudo encontrar la información del usuario que robó.");

			// Aplicar cooldown
			setCooldown(client, user.id, "cap", cooldownDuration);

			const profit = amount;

			// Actualizar el dinero del usuario que robó
			if ((robberData.cash ?? 0) > profit) robberData.cash = (robberData.cash ?? 0) - profit;
			else robberData.bank = (robberData.bank ?? 0) - profit;

			// Actualizar el dinero del usuario actual
			userData.cash = (userData.cash ?? 0) + profit;
			userData.caps = (userData.caps ?? 0) + profit;

			try {
				await Promise.all([Users.updateOne({ id: user.id }, userData).exec(), Users.updateOne({ id: robberId }, robberData).exec()]);
			} catch (error) {
				console.error("Error actualizando los usuarios:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Eliminar al usuario que robó de la lista
			if (reactionTime > 0) client.lastRobs = entries.filter((rob) => rob.userId !== robberId);

			// Actualizar quest
			try {
				await checkQuestLevel({
					msg: interaction,
					money: profit,
					userId: user.id,
				} as IQuest);
			} catch (error) {
				console.error("Error actualizando la quest:", error);
				// Puedes optar por enviar una advertencia o simplemente registrar el error
			}

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
				.setThumbnail("https://cdn.discordapp.com/emojis/1019809933451071519.webp?size=96&quality=lossless")
				.setDescription(
					`Has logrado sacarle **${profit.toLocaleString()}** monedas de la cuenta de \`${
						member.user.username
					}\`.\nBuen trabajo oficial.`
				)
				.setTimestamp();

			await replyOk(interaction, [embed], undefined, undefined, undefined, undefined, false);
		},
		[]
	),
};
