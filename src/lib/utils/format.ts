/**
 * Date formatting utilities using native Intl APIs.
 * Auto-detects user's browser locale for international deployments.
 */

/**
 * Format a timestamp as a date string.
 * @param timestamp - Unix timestamp in milliseconds
 * @param style - Date style: 'short' (12/20/24), 'medium' (Dec 20, 2024), 'long' (December 20, 2024)
 */
export function formatDate(
	timestamp: number,
	style: 'short' | 'medium' | 'long' = 'medium'
): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle: style }).format(new Date(timestamp));
}

/**
 * Format a timestamp as a date and time string.
 * @param timestamp - Unix timestamp in milliseconds
 * @param dateStyle - Date style
 * @param timeStyle - Time style: 'short' (1:30 PM), 'medium' (1:30:00 PM)
 */
export function formatDateTime(
	timestamp: number,
	dateStyle: 'short' | 'medium' | 'long' = 'medium',
	timeStyle: 'short' | 'medium' = 'short'
): string {
	return new Intl.DateTimeFormat(undefined, { dateStyle, timeStyle }).format(new Date(timestamp));
}

/**
 * Format a timestamp as a time string only.
 * @param timestamp - Unix timestamp in milliseconds
 * @param style - Time style
 */
export function formatTime(timestamp: number, style: 'short' | 'medium' = 'short'): string {
	return new Intl.DateTimeFormat(undefined, { timeStyle: style }).format(new Date(timestamp));
}
