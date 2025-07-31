import CommandService from "./services/CommandService.js";
import EconomyService from "./services/EconomyService.js";
import PetService from "./services/PetService.js";
import TrendingService from "./services/TrendingService.js";
import NewsService from "./services/NewsService.js";
import AIUsageControlService from "./services/AIUsageControlService.js";
import ForumPostControlService from "./services/ForumPostControlService.js";
import AutoRoleService from "./services/AutoRoleService.js";
import ActivityService from "./services/ActivityService.js";

export interface ServiceInstanceMap {
	commands: CommandService;
	economy: EconomyService;
	pets: PetService;
	trending: TrendingService;
	news: NewsService;
	aiUsage: AIUsageControlService;
        forumPostControl: ForumPostControlService;
        autoRole: AutoRoleService;
        activity: ActivityService;
}

export type ServiceName = keyof ServiceInstanceMap;
