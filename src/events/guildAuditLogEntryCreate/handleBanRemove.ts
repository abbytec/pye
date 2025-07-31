import { Guild, GuildAuditLogsEntry, TextChannel, User } from "discord.js";
import { getChannelFromEnv } from "../../utils/constants.js";
import { ModLogs } from "../../Models/ModLogs.js";

export async function handleBanRemove(entry: GuildAuditLogsEntry, guild: Guild) {
	const { target, executor } = entry;
	if (!target || entry.targetType !== "User" || !executor) return;
	const targetUser = target as User;
	const memberId = targetUser.id;
	const channel = guild.channels.resolve(getChannelFromEnv("bansanciones")) as TextChannel | null;

	if (!executor.bot) {
		await channel?.send({
			content: `El miembro **${targetUser.username} (${memberId})** fue desbaneado manualmente por **${executor.tag}**.`,
		});
		await ModLogs.findOneAndUpdate(
			{ id: memberId, type: "Ban", hiddenCase: { $ne: true } },
			{
				$set: { hiddenCase: true, reasonUnpenalized: entry.reason ?? "No se proporciono una razon." },
			},
			{ sort: { date: -1 }, new: true }
		).catch(() => null);
	}
}
