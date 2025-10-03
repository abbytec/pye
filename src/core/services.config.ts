import CommandService from "./services/CommandService.js";
import EconomyService from "./services/EconomyService.js";
import PetService from "./services/PetService.js";
import TrendingService from "./services/TrendingService.js";
import NewsService from "./services/NewsService.js";
import AIUsageControlService from "./services/AIUsageControlService.js";
import ForumPostControlService from "./services/ForumPostControlService.js";
import AutoRoleService from "./services/AutoRoleService.js";
import ActivityService from "./services/ActivityService.js";
import GlobalInteractionService from "./services/GlobalInteractionService.js";
import TempVoiceService from "./services/TempVoiceService.js";
import MessageWatcherService from "./services/MessageWatcherService.js";
import VoiceWatcherService from "./services/VoiceWatcherService.js";
import InviteWatcherService from "./services/InviteWatcherService.js";
import MemberWatcherService from "./services/MemberWatcherService.js";
import ReminderService from "./services/ReminderService.js";
import ScheduledMessagesService from "./services/ScheduledMessagesService.js";
import CommunityRewardsService from "./services/CommunityRewardsService.js";

export interface ServiceInstanceMap {
	reminder: ReminderService;
	scheduledMessages: ScheduledMessagesService;
	communityRewards: CommunityRewardsService;
	globalInteraction: GlobalInteractionService;
	commands: CommandService;
	economy: EconomyService;
	pets: PetService;
	trending: TrendingService;
	news: NewsService;
	aiUsage: AIUsageControlService;
	forumPostControl: ForumPostControlService;
	autoRole: AutoRoleService;
	activity: ActivityService;
	tempVoice: TempVoiceService;
	messageWatcher: MessageWatcherService;
	voiceWatcher: VoiceWatcherService;
	inviteWatcher: InviteWatcherService;
	memberWatcher: MemberWatcherService;
}

export type ServiceName = keyof ServiceInstanceMap;
