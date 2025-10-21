// src/utils/bumpHandler.ts

import { EmbedBuilder, Message, Guild, TextChannel } from "discord.js";
import { Money } from "../../../Models/Money.js";
import { Users } from "../../../Models/User.js";
import { Bumps } from "../../../Models/Bump.js";
import { COLORS, DISBOARD_UID, EMOJIS, getChannelFromEnv, pyecoin } from "../../constants.js";
import { ExtendedClient } from "../../../client.js";
import { checkQuestLevel, IQuest } from "../../quest.js";
import { increaseHomeMonthlyIncome } from "../../../Models/Home.js";

export function bumpHandler(message: Message) {
	if (
		message.author.id === DISBOARD_UID &&
		message.embeds.length &&
		message.embeds[0].data.color == COLORS.lightSeaGreen &&
		message.embeds[0].data.description?.includes(EMOJIS.thumbsUp)
	) {
		bumpEmitter(message);
		return true;
	}
	return false;
}

/**
 * Maneja el evento de bump de un usuario.
 *
 * @param client - El cliente de Discord.
 * @param message - El mensaje de interacción que desencadenó el bump.
 */
export async function bumpEmitter(message: Message): Promise<void> {
	try {
		if (!message.interactionMetadata) return;

		const ganadorId = message.interactionMetadata.user.id;

		// Obtener los documentos de Money y Users
		const money = await Money.findById(process.env.CLIENT_ID).catch(() => null);
		if (!money) {
			ExtendedClient.logError("No se encontró el documento de Money para el bot con ID: " + process.env.CLIENT_ID);
			return;
		}

		const user = await Users.findOne({ id: ganadorId }).catch(() => null);
		if (!user) {
			ExtendedClient.logError("No se encontró el usuario con ID: " + ganadorId);
			return;
		}

		// Ajustar bump según el trabajo y las parejas
		let bumpAmount = money.bump;

		if (["Enfermero", "Enfermera"].includes(user.profile?.job ?? "") && user.couples?.some((s) => ["Doctor", "Doctora"].includes(s.job))) {
			bumpAmount += bumpAmount * 0.5;
		}

		if (["Doctor", "Doctora"].includes(user.profile?.job ?? "") && user.couples?.some((s) => ["Enfermero", "Enfermera"].includes(s.job))) {
			bumpAmount += bumpAmount * 0.5;
		}

		bumpAmount = Math.floor(bumpAmount);
		user.cash += bumpAmount;

		await user.save();

		await increaseHomeMonthlyIncome(ganadorId, bumpAmount);
		await checkQuestLevel({
			msg: message,
			userId: ganadorId,
			bump: 1,
			money: bumpAmount,
		} as IQuest);

		// Registrar el bump
		await Bumps.create({ user: ganadorId, fecha: new Date() });

		// Obtener el miembro del guild
		const member = (message.guild as Guild).members.cache.get(ganadorId);
		if (!member) {
			console.error(`No se encontró el miembro con ID: ${ganadorId}`);
			return;
		}

		// Crear y enviar el embed de agradecimiento
		const embed = new EmbedBuilder()
			.setColor(COLORS.okGreen)
			.setAuthor({
				name: member.user.tag,
				iconURL: member.user.displayAvatarURL(),
			})
			.setDescription(
				`¡ Gracias por ese bump <@${ganadorId}> !\nHas recibido ${pyecoin} **${bumpAmount}** como recompensa.\n En 2 horas avisaré nuevamente cuando sea momento de bumpear!`
			);

		await (message.channel as TextChannel | undefined)?.send({ embeds: [embed] });

		// Notificar al usuario que puede hacer bump nuevamente después de 2 horas
		setTimeout(async () => {
			await member
				.send({
					embeds: [
						new EmbedBuilder()
							.setDescription(`¡ Ya puedes hacer bump de nuevo ! 🎉\n<#${getChannelFromEnv("casino")}>`)
							.setColor(COLORS.okGreen),
					],
				})
				.catch(() => null);
			await (message.channel as TextChannel | undefined)
				?.send({
					embeds: [
						new EmbedBuilder()
							.setDescription(
								`¡ Ya se puede bumpear de nuevo ! 🎉\nPuedes hacerlo escribiendo /bump y eligiendo la opción de <@${DISBOARD_UID}> para ganar monedas del servidor.`
							)
							.setColor(COLORS.okGreen),
					],
				})
				.catch(() => null);
		}, 7200 * 1000); // 7200 segundos = 2 horas
	} catch (error: any) {
		console.error("Error al manejar el bump:", error);
		ExtendedClient.logError("Error al manejar el bump: " + error.message, error.stack, process.env.CLIENT_ID);
	}
}
