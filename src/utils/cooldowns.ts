import { ExtendedClient } from "../client.js";
import { Cooldowns, ICooldown } from "../Models/Cooldown.js";

const thirtyMinutes = 30 * 60 * 1000;

/**
 * Retrieves the remaining cooldown time for a user and command.
 * @param client - The ExtendedClient instance.
 * @param userId - The ID of the user.
 * @param commandName - The name of the command.
 * @param expectedCooldown - The expected cooldown duration in milliseconds.
 * @returns The remaining cooldown time in milliseconds.
 */
export async function getCooldown(client: ExtendedClient, userId: string, commandName: string, expectedCooldown: number): Promise<number> {
	const key = `${userId}:${commandName}`;

	if (expectedCooldown < thirtyMinutes) {
		const cooldownEntry = client.services.commands.cooldowns.get(key);
		if (!cooldownEntry) {
			return 0;
		}

		const remaining = cooldownEntry.date.getTime() - Date.now();

		if (remaining <= 0) {
			// Cooldown has expired, remove from map
			client.services.commands.cooldowns.delete(key);
			return 0;
		} else {
			return remaining;
		}
	} else {
		// Use database
		const cooldownEntry = await Cooldowns.findOne({ user: userId, command: commandName }, "date");
		if (!cooldownEntry) {
			return 0;
		}

		const remaining = cooldownEntry.date.getTime() - Date.now();

		if (remaining <= 0) {
			// Cooldown has expired, remove from database
			await Cooldowns.deleteOne({ user: userId, command: commandName });
			return 0;
		} else {
			return remaining;
		}
	}
}

/**
 * Sets or resets the cooldown for a user and command.
 * @param client - The ExtendedClient instance.
 * @param userId - The ID of the user.
 * @param commandName - The name of the command.
 * @param duration - The duration of the cooldown in milliseconds.
 */
export async function setCooldown(client: ExtendedClient, userId: string, commandName: string, duration: number): Promise<void> {
	const newDate = new Date(Date.now() + duration);

	if (duration < thirtyMinutes) {
		// Use client.cooldowns Map
		const cooldownEntry: ICooldown = {
			user: userId,
			command: commandName,
			date: newDate,
		};
		client.services.commands.cooldowns.set(`${userId}:${commandName}`, cooldownEntry);
	} else {
		// Use database
		const cooldownEntry = await Cooldowns.findOneAndUpdate(
			{
				user: userId,
				command: commandName,
			},
			{ $set: { date: newDate } },
			{ new: true }
		);

		if (!cooldownEntry) {
			await Cooldowns.create({
				user: userId,
				command: commandName,
				date: newDate,
			});
		}
	}
}
