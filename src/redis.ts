import redis from "redis";
import { ExtendedClient } from "./client.js";
import loadEnvVariables from "./utils/environment.js";
loadEnvVariables();
const client = redis.createClient({
	socket: {
		host: process.env.REDIS_HOST,
		port: Number(process.env.REDIS_PORT),
	},
});

// Manejar errores de forma continua

const LOG_INTERVAL = 10 * 60 * 1000; // 10 minutos

(async () => {
	await client
		.connect()
		.then(() => {
			console.log("Redis listo!");
			let canLogError = true;
			client.on("error", () => {
				if (!canLogError) return;
				ExtendedClient.logError("Error de conectividad con Redis (listener)");
				canLogError = false;
				setTimeout(() => {
					canLogError = true;
				}, LOG_INTERVAL);
			});
		})
		.catch((err) => {
			console.error("Error de Redis:", err);
			process.exit(1);
		});
})();

export default client;
