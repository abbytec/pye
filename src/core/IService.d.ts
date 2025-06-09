import { ServiceName } from "./services.config.js";
export interface IService {
	readonly serviceName: ServiceName;
	start?(): Promise<void> | void;
	dailyRepeat?(): Promise<void> | void;
	stop?(): Promise<void> | void;
}

export interface IServiceCtor {
	new (client: ExtendedClient): IService;
	serviceName: string;
}
