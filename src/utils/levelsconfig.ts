// src/utils/levelsConfig.ts
import { EmbedBuilder } from "discord.js";
import { EconomyService } from "../core/services/EconomyService.js";

export interface LevelRequirements {
	money?: () => number;
	bump?: number;
	text?: number;
	rep?: number;
}

export interface InteractiveReward {
	type: "color" | "pet";
}

export interface LevelConfig {
	level: number;
	requirements: LevelRequirements;
	game?: boolean; // Si true, solo se puede subir de nivel si el dinero proviene de juegos.
	interactiveReward?: InteractiveReward; // Si existe, se activa el proceso interactivo tras cumplir el requisito.
	levelUpEmbed?: (username: string, newLevel: number) => EmbedBuilder;
}

export const levels: LevelConfig[] = [
	{
		level: 1,
		requirements: { money: () => inflatedMoney(1000) },
		interactiveReward: { type: "color" },
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 2,
		requirements: { money: () => inflatedMoney(2000) },
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 3,
		requirements: { money: () => inflatedMoney(3000) },
		game: true,
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 4,
		requirements: { money: () => inflatedMoney(4000), bump: 1 },
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 5,
		requirements: { text: 300 },
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 6,
		requirements: { money: () => inflatedMoney(5000) },
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 7,
		requirements: { money: () => inflatedMoney(6000) },
		game: true,
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 8,
		requirements: { text: 500 },
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 9,
		requirements: { money: () => inflatedMoney(7000), bump: 2, rep: 1 },
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 10,
		requirements: { money: () => inflatedMoney(8000) },
		game: true,
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 11,
		requirements: { money: () => inflatedMoney(9000), rep: 2 },
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
	{
		level: 12,
		requirements: { text: 1000 },
		interactiveReward: { type: "pet" },
		levelUpEmbed: (username, newLevel) =>
			new EmbedBuilder()
				.setAuthor({ name: "🏠 Nuevo nivel en tu casa." })
				.setDescription(`\`${username}\` ha subido al nivel: \`${newLevel}\``)
				.setTimestamp(),
	},
];
export const MAX_LEVEL = levels.length;
function inflatedMoney(money: number) {
	return EconomyService.getInflatedRate(money);
}
