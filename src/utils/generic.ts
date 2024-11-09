export const getRandomNumber = (min = 0, max = 1) => (Math.random() * (max - min) + min) | 0;

/**
 * Formats a time duration in milliseconds to a human-readable string.
 * @param milliseconds - The time duration in milliseconds.
 * @returns A formatted time string.
 */
export function formatTime(milliseconds: number): string {
	const totalSeconds = Math.floor(milliseconds / 1000);

	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	const hoursDisplay = hours > 0 ? `${hours}h ` : "";
	const minutesDisplay = minutes > 0 ? `${minutes}m ` : "";
	const secondsDisplay = seconds > 0 ? `${seconds}s` : "";

	return `${hoursDisplay}${minutesDisplay}${secondsDisplay}`.trim();
}
