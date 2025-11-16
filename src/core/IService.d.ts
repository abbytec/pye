import { ServiceName } from "./services.config.js";
export interface IService {
	readonly serviceName: ServiceName;
	start?(): Promise<void> | void;
	/** Ejecutado una vez que todos los servicios finalizaron su start */
	firstRun?(): Promise<void> | void;
	dailyRepeat?(): Promise<void> | void;
	monthlyRepeat?(): Promise<void> | void;
	stop?(): Promise<void> | void;
}

export interface IServiceCtor {
	new (client: ExtendedClient): IService;
	serviceName: string;
}
