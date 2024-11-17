// src/utils/bumpHandler.ts

import { GuildMember, EmbedBuilder, Message, Guild, TextChannel } from "discord.js";
import { Money } from "../Models/Money.ts";
import { Users } from "../Models/User.ts";
import { Bumps } from "../Models/Bump.ts";
import { pyecoin } from "./constants.ts";
import { ExtendedClient } from "../client.ts";
import { checkQuestLevel, IQuest } from "./quest.ts";
import { increaseHomeMonthlyIncome } from "../Models/Home.ts";

/**
 * Maneja el evento de bump de un usuario.
 *
 * @param client - El cliente de Discord.
 * @param message - El mensaje de interacción que desencadenó el bump.
 */
export async function bumpHandler(client: ExtendedClient, message: Message): Promise<void> {
	try {
		if (!message.interactionMetadata) return;

		const ganadorId = message.interactionMetadata.user.id;

		// Obtener los documentos de Money y Users
		const money = await Money.findById(client.user?.id).exec();
		if (!money) {
			console.error(`No se encontró el documento de Money para el bot con ID: ${client.user?.id}`);
			return;
		}

		const user = await Users.findOne({ id: ganadorId }).exec();
		if (!user) {
			console.error(`No se encontró el usuario con ID: ${ganadorId}`);
			return;
		}

		// Ajustar bump según el trabajo y las parejas
		let bumpAmount = money.bump;

		if (["Enfermero", "Enfermera"].includes(user.profile?.job || "") && user.couples?.some((s) => ["Doctor", "Doctora"].includes(s.job))) {
			bumpAmount += bumpAmount * 0.5;
		}

		if (["Doctor", "Doctora"].includes(user.profile?.job || "") && user.couples?.some((s) => ["Enfermero", "Enfermera"].includes(s.job))) {
			bumpAmount += bumpAmount * 0.5;
		}

		bumpAmount = Math.floor(bumpAmount);
		money.bump = bumpAmount;
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
			.setColor(0x00ff00)
			.setAuthor({
				name: member.user.tag,
				iconURL: member.user.displayAvatarURL(),
			})
			.setDescription(`¡ Gracias por ese bump <@${ganadorId}> !\nHas recibido ${pyecoin} **${bumpAmount}** como recompensa.`);

		await (message.channel as TextChannel).send({ embeds: [embed] });

		// Notificar al usuario que puede hacer bump nuevamente después de 2 horas
		setTimeout(async () => {
			try {
				await member.send({
					embeds: [new EmbedBuilder().setDescription("¡ Ya puedes hacer bump de nuevo !").setColor(0x00ff00)],
				});
			} catch (error) {
				console.error(`No se pudo enviar el DM al usuario con ID: ${ganadorId}`, error);
			}
		}, 7200 * 1000); // 7200 segundos = 2 horas
	} catch (error) {
		console.error("Error en bumpHandler:", error);
		// Aquí puedes agregar lógica adicional para manejar errores, como notificar a un canal de logs
	}
}
