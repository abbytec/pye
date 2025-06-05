import { ExtendedClient } from "../client.js";
import { HelperPoint, IHelperPoint } from "../Models/HelperPoint.js";
import { UserRole } from "../Models/Role.js";
import { CoreClient } from "./CoreClient.js";

export class AutoRoleService {
	public static adaLovelaceReps: number = 512;
	public static adaLovelaceTop10Id: string = "";

	constructor(private readonly client: CoreClient) {}

	public static async updateAdaLovelace() {
		await HelperPoint.find()
			.sort({ points: -1 })
			.skip(9)
			.limit(1)
			.lean()
			.then((res: IHelperPoint[]) => {
				AutoRoleService.adaLovelaceTop10Id = res.at(0)?._id ?? "";
				AutoRoleService.adaLovelaceReps = res.at(0)?.points ?? 512;
			});
	}

	public static async borrarRolesTemporales() {
		let arr = await UserRole.find().exec();
		let guild = ExtendedClient.guildManager?.resolve(process.env.GUILD_ID ?? "");
		if (arr.length && guild) {
			for (const data of arr) {
				if (data.count < Date.now()) {
					let member = guild.members.resolve(data.id);
					if (member) member.roles.remove(data.rolId);
					await data.deleteOne();
				}
			}
		}
	}
}
