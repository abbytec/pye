import redis from "redis";

const client = redis.createClient({
	socket: {
		host: process.env.REDIS_HOST,
		port: Number(process.env.REDIS_PORT),
	},
});

// Manejar errores de forma continua
client.on("error", (err) => {
	console.error("Error de Redis (listener):", err);
});

(async () => {
	try {
		await client.connect();
		console.log("Redis listo!");
	} catch (err) {
		console.error("Error de Redis:", err);
		process.exit(1);
	}
})();

export default client;
