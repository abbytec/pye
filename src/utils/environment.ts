import dotenv from "dotenv";
import path from "node:path";
const isDevelopment = process.env.NODE_ENV === "development";

export default function loadEnvVariables() {
	const envPath = isDevelopment ? path.resolve(process.cwd(), ".env.development") : path.resolve(process.cwd(), ".env");
	dotenv.config({ path: envPath });
}
