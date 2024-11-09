import { ExtendedClient } from "../client.ts";
import { Cooldowns, ICooldown } from "../Models/Cooldown.ts";

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
		// Use client.cooldowns Map
		const cooldownEntry = client.cooldowns.get(key);
		if (!cooldownEntry) {
			return 0;
		}

		const remaining = cooldownEntry.date.getTime() - Date.now();

		if (remaining <= 0) {
			// Cooldown has expired, remove from map
			client.cooldowns.delete(key);
			return 0;
		} else {
			return remaining;
		}
	} else {
		// Use database
		const cooldownEntry = await Cooldowns.findOne({ user: userId, command: commandName }, "date").exec();
		if (!cooldownEntry) {
			return 0;
		}

		const remaining = cooldownEntry.date.getTime() - Date.now();

		if (remaining <= 0) {
			// Cooldown has expired, remove from database
			await Cooldowns.deleteOne({ user: userId, command: commandName }).exec();
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
		client.cooldowns.set(`${userId}:${commandName}`, cooldownEntry);
	} else {
		// Use database
		let cooldownEntry = await Cooldowns.findOne({
			user: userId,
			command: commandName,
		}).exec();

		if (!cooldownEntry) {
			cooldownEntry = new Cooldowns({
				user: userId,
				command: commandName,
				date: newDate,
			});
		} else {
			cooldownEntry.date = newDate;
		}

		await cooldownEntry.save();
	}
}
