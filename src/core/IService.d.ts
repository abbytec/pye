export interface IService {
	start?(): Promise<void> | void;
	dailyRepeat?(): Promise<void> | void;
	stop?(): Promise<void> | void;
}
