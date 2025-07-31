import { ActivityType } from "discord.js";
import { CoreClient } from "../CoreClient.js";
import { IService } from "../IService.js";

export default class ActivityService implements IService {
	public readonly serviceName = "activity";
	private readonly URL_STATE = "🔗 discord.gg/programacion";

	constructor(private readonly client: CoreClient) {}

	start() {
		setInterval(() => {
			setTimeout(
				() => this.client.user?.setActivity("discord.gg/programacion", { type: ActivityType.Watching, state: this.URL_STATE }),
				1000
			);
			setTimeout(
				() => this.client.user?.setActivity("ella no te ama, pyechan tampoco", { type: ActivityType.Watching, state: this.URL_STATE }),
				10000
			);
			setTimeout(
				() => this.client.user?.setActivity("+20 Millones de comentarios", { type: ActivityType.Watching, state: this.URL_STATE }),
				20000
			);
			setTimeout(
				() =>
					this.client.user?.setActivity("PyE coins en el Casino (#comandos)", { type: ActivityType.Competing, state: this.URL_STATE }),
				30000
			);
			setTimeout(
				() =>
					this.client.user?.setActivity(
						`a ${this.client.guilds.cache.get(process.env.GUILD_ID ?? "")?.memberCount ?? "\ud83d\udc40"}`,
						{ type: ActivityType.Watching, state: this.URL_STATE }
					),
				40000
			);
		}, 50000);
	}
}
