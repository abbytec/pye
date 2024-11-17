import { Events, ActivityType } from "discord.js";
import { ExtendedClient } from "../client.ts";
import { CommandLimits, ICommandLimits } from "../Models/Command.ts";
import { Money, IMoney } from "../Models/Money.ts";

export default {
	name: Events.ClientReady,
	once: true,
	async execute(client: ExtendedClient) {
		console.log(`Bot Listo como: ${client.user?.tag} ! `);

		await CommandLimits.find().then((res: ICommandLimits[]) => {
			res.forEach((command) => {
				client.setCommandLimit(command);
			});
		});
		await Money.find().then((res: IMoney[]) => {
			res.forEach((money) => {
				client.setMoneyConfig(money);
			});
		});

		setInterval(() => {
			setTimeout(() => client.user?.setActivity("discord.gg/programacion", { type: ActivityType.Watching }), 1000);
			setTimeout(() => client.user?.setActivity("ella no te ama", { type: ActivityType.Watching }), 10000);
			setTimeout(() => client.user?.setActivity("+20 Millones de comentarios", { type: ActivityType.Watching }), 20000);
			setTimeout(() => client.user?.setActivity("PyE coins del #casino", { type: ActivityType.Competing }), 30000);
			setTimeout(
				() =>
					client.user?.setActivity(`a ${client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)}`, {
						type: ActivityType.Watching,
					}),
				40000
			);
		}, 50000);
	},
};
