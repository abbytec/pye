import dotenv from "dotenv";
const isDevelopment = process.env.NODE_ENV === "development";

export default function loadEnvVariables() {
	if (isDevelopment) {
		dotenv.config({ path: "./.env.development" });
	} else {
		dotenv.config({ path: "./.env" });
	}
}
