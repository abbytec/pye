import { ExtendedClient } from "../../client.js";
import { HelperPoint, IHelperPoint } from "../../Models/HelperPoint.js";
import { UserRole } from "../../Models/Role.js";
import { CoreClient } from "../CoreClient.js";
import { IService } from "../IService.js";

export default class AutoRoleService implements IService {
	public static adaLovelaceReps: number = 512;
	public static adaLovelaceTop10Id: string = "";
	public readonly serviceName = "autoRole";

	constructor(private readonly client: CoreClient) {}

	async start() {
		await this.updateAdaLovelace();
		setInterval(async () => {
			await this.borrarRolesTemporales();
		}, 36e5);
	}

	async updateAdaLovelace() {
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

	private async borrarRolesTemporales() {
		const arr = await UserRole.find().exec();
		const guild = ExtendedClient.guild;
		if (arr.length && guild) {
			for (const data of arr) {
				if (data.count < Date.now()) {
					const member = guild.members.resolve(data.id);
					if (member) member.roles.remove(data.rolId);
					await data.deleteOne();
				}
			}
		}
	}
}
