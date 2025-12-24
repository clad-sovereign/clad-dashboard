/**
 * CSV parser for batch whitelist operations.
 *
 * Parses CSV files containing SS58 addresses, validates them,
 * and detects duplicates within the file.
 */

import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';

/**
 * Validation status for a parsed address
 */
export type AddressValidationStatus = 'valid' | 'invalid' | 'duplicate' | 'already_whitelisted';

/**
 * A parsed address entry from CSV
 */
export interface ParsedAddress {
	/** Original address as it appeared in the CSV */
	originalAddress: string;
	/** Normalized SS58 address (if valid) */
	normalizedAddress: string | null;
	/** Line number in the CSV (1-indexed) */
	lineNumber: number;
	/** Validation status */
	status: AddressValidationStatus;
	/** Error message if invalid */
	error?: string;
}

/**
 * Result of parsing a CSV file
 */
export interface CsvParseResult {
	/** All parsed entries */
	entries: ParsedAddress[];
	/** Count of valid addresses */
	validCount: number;
	/** Count of invalid addresses */
	invalidCount: number;
	/** Count of duplicates within the file */
	duplicateCount: number;
	/** Count of addresses already on the whitelist */
	alreadyWhitelistedCount: number;
}

/**
 * Validate and normalize an SS58 address.
 *
 * @param address - Raw address string to validate
 * @returns Normalized address if valid, null if invalid
 */
export function validateSS58Address(address: string): {
	valid: boolean;
	normalized?: string;
	error?: string;
} {
	const trimmed = address.trim();
	if (!trimmed) {
		return { valid: false, error: 'Empty address' };
	}

	try {
		const decoded = decodeAddress(trimmed);
		const normalized = encodeAddress(decoded);
		return { valid: true, normalized };
	} catch {
		return { valid: false, error: 'Invalid SS58 address format' };
	}
}

/**
 * Parse a CSV file content containing addresses.
 *
 * Supports:
 * - Single column CSV (address per line)
 * - Multi-column CSV with 'address' header
 * - Comments starting with # are ignored
 * - Empty lines are ignored
 *
 * @param content - Raw CSV file content
 * @param existingWhitelist - Optional set of already-whitelisted addresses for duplicate checking
 * @returns Parsed result with validation status for each address
 */
export function parseAddressCsv(content: string, existingWhitelist?: Set<string>): CsvParseResult {
	const lines = content.split(/\r?\n/);
	const entries: ParsedAddress[] = [];
	const seenAddresses = new Map<string, number>(); // normalized address -> first line number

	let validCount = 0;
	let invalidCount = 0;
	let duplicateCount = 0;
	let alreadyWhitelistedCount = 0;

	// Detect if first line is a header
	let startLine = 0;
	let addressColumnIndex = 0;

	if (lines.length > 0) {
		const firstLine = lines[0].toLowerCase().trim();
		if (firstLine.includes('address') || firstLine === 'account' || firstLine === 'wallet') {
			// This is a header row
			startLine = 1;
			// Find the address column
			const columns = parseCSVLine(lines[0]);
			const idx = columns.findIndex(
				(col) =>
					col.toLowerCase() === 'address' ||
					col.toLowerCase() === 'account' ||
					col.toLowerCase() === 'wallet'
			);
			if (idx >= 0) {
				addressColumnIndex = idx;
			}
		}
	}

	for (let i = startLine; i < lines.length; i++) {
		const line = lines[i].trim();
		const lineNumber = i + 1;

		// Skip empty lines and comments
		if (!line || line.startsWith('#')) {
			continue;
		}

		// Parse CSV line (handles quoted values)
		const columns = parseCSVLine(line);
		const rawAddress = columns[addressColumnIndex]?.trim() || '';

		if (!rawAddress) {
			continue;
		}

		// Validate the address
		const validation = validateSS58Address(rawAddress);

		if (!validation.valid) {
			entries.push({
				originalAddress: rawAddress,
				normalizedAddress: null,
				lineNumber,
				status: 'invalid',
				error: validation.error
			});
			invalidCount++;
			continue;
		}

		const normalized = validation.normalized!;

		// Check for duplicates within the file
		const existingLine = seenAddresses.get(normalized);
		if (existingLine !== undefined) {
			entries.push({
				originalAddress: rawAddress,
				normalizedAddress: normalized,
				lineNumber,
				status: 'duplicate',
				error: `Duplicate of line ${existingLine}`
			});
			duplicateCount++;
			continue;
		}

		// Check if already on whitelist
		if (existingWhitelist?.has(normalized)) {
			entries.push({
				originalAddress: rawAddress,
				normalizedAddress: normalized,
				lineNumber,
				status: 'already_whitelisted',
				error: 'Already on whitelist'
			});
			alreadyWhitelistedCount++;
			seenAddresses.set(normalized, lineNumber);
			continue;
		}

		// Valid and unique
		entries.push({
			originalAddress: rawAddress,
			normalizedAddress: normalized,
			lineNumber,
			status: 'valid'
		});
		seenAddresses.set(normalized, lineNumber);
		validCount++;
	}

	return {
		entries,
		validCount,
		invalidCount,
		duplicateCount,
		alreadyWhitelistedCount
	};
}

/**
 * Parse a single CSV line, handling quoted values.
 */
function parseCSVLine(line: string): string[] {
	const result: string[] = [];
	let current = '';
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"') {
			if (inQuotes && line[i + 1] === '"') {
				// Escaped quote
				current += '"';
				i++;
			} else {
				inQuotes = !inQuotes;
			}
		} else if (char === ',' && !inQuotes) {
			result.push(current.trim());
			current = '';
		} else {
			current += char;
		}
	}

	result.push(current.trim());
	return result;
}

/**
 * Get valid addresses from a parse result.
 */
export function getValidAddresses(result: CsvParseResult): string[] {
	return result.entries.filter((e) => e.status === 'valid').map((e) => e.normalizedAddress!);
}

/**
 * Format a file size for display.
 */
export function formatFileSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
