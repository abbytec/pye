// src/commands/Currency/cap.ts

import { SlashCommandBuilder, EmbedBuilder, GuildMember, Guild } from "discord.js";
import { getOrCreateUser, IUserModel, Users } from "../../Models/User.js";
import { composeMiddlewares } from "../../helpers/composeMiddlewares.js";
import { verifyIsGuild } from "../../utils/middlewares/verifyIsGuild.js";
import { deferInteraction } from "../../utils/middlewares/deferInteraction.js";
import { PostHandleable } from "../../types/middleware.js";
import { replyOk } from "../../utils/messages/replyOk.js";
import { replyError } from "../../utils/messages/replyError.js";
import { IUser } from "../../interfaces/IUser.js";
import { checkQuestLevel, IQuest } from "../../utils/quest.js";
import { setCooldown } from "../../utils/cooldowns.js";
import { ExtendedClient } from "../../client.js";
import { verifyCooldown } from "../../utils/middlewares/verifyCooldown.js";
import { Rob } from "./rob.js";
import { IPrefixChatInputCommand } from "../../interfaces/IPrefixChatInputCommand.js";
import { PrefixChatInputCommand } from "../../utils/messages/chatInputCommandConverter.js";
import { CommandService } from "../../core/services/CommandService.js";

const cooldownDuration = 1 * 60 * 60 * 1000;

const policeReactionTime = 3e4;
const militarReactionTime = 6e4;

export default {
	group: "💰 - Farmeo de PyeCoins (Casino)",
	data: new SlashCommandBuilder().setName("cap").setDescription("Es como el rob, pero le quitas a los rateros."),
	execute: composeMiddlewares(
		[verifyIsGuild(process.env.GUILD_ID ?? ""), verifyCooldown("cap", cooldownDuration, undefined, false), deferInteraction()],
		async (interaction: IPrefixChatInputCommand): Promise<PostHandleable | void> => {
			const user = interaction.user;

			// Obtener datos del usuario
			let userData: IUserModel = await getOrCreateUser(user.id);

			// Verificar que el usuario tenga perfil y trabajo adecuado
			if (!userData.profile || !["Militar", "Policia"].includes(userData.profile.job))
				return await replyError(interaction, "No estás autorizado para usar este comando.");

			const client = interaction.client;
			const guild = interaction.guild as Guild;
			let reactionTime = 0;
			if (userData.profile.job === "Policia") reactionTime = policeReactionTime;
			if (userData.profile.job === "Militar") reactionTime = militarReactionTime;

			let entries: Rob[] = [];
			if (reactionTime > 0) {
				entries =
					CommandService.lastRobs.filter((rob) => rob.lastTime > Date.now() - reactionTime).sort((a, b) => b.lastTime - a.lastTime) ??
					[];
				if (entries.length === 0) return await replyError(interaction, "No ha habido ningún robo reciente.");
			} else {
				return await replyError(interaction, "No estás autorizado para usar este comando.");
			}

			const { userId: robberId, amount } = entries[0];
			const member = await guild.members.fetch(robberId).catch(() => null as GuildMember | null);

			if (!member) return await replyError(interaction, "El último usuario en robar ya no se encuentra en el servidor.");

			let robberData: IUser | null = await Users.findOne({ id: robberId });
			if (!robberData) return await replyError(interaction, "No se pudo encontrar la información del usuario que robó.");

			// Aplicar cooldown
			await setCooldown(client, user.id, "cap", cooldownDuration);

			try {
				await Users.updateOne({ id: user.id }, { $inc: { cash: amount, caps: amount } });
				await Users.updateOne({ id: robberId }, { $inc: (robberData.cash ?? 0) > amount ? { cash: -amount } : { bank: -amount } });
			} catch (error) {
				console.error("Error actualizando los usuarios:", error);
				return await replyError(interaction, "Hubo un error al procesar tu solicitud. Inténtalo de nuevo más tarde.");
			}

			// Eliminar al usuario que robó de la lista
			if (reactionTime > 0) CommandService.lastRobs = entries.filter((rob) => rob.userId !== robberId);

			// Actualizar quest
			try {
				checkQuestLevel({
					msg: interaction,
					money: amount,
					userId: user.id,
				} as IQuest);
			} catch (error) {
				console.error("Error actualizando la quest:", error);
			}

			// Crear embed de respuesta
			const embed = new EmbedBuilder()
				.setAuthor({ name: user.tag, iconURL: user.displayAvatarURL() })
				.setThumbnail("https://cdn.discordapp.com/emojis/1019809933451071519.webp?size=96&quality=lossless")
				.setDescription(
					`Has logrado sacarle **${amount.toLocaleString()}** monedas de la cuenta de \`${
						member.user.username
					}\`.\nBuen trabajo oficial.`
				)
				.setTimestamp();

			await replyOk(interaction, [embed], undefined, undefined, undefined, undefined, false);
		},
		[]
	),
	prefixResolver: (client: ExtendedClient) => new PrefixChatInputCommand(client, "cap", []),
} as Command;
