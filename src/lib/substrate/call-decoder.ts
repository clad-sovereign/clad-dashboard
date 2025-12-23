/**
 * Utility for decoding SCALE-encoded call data using @polkadot/api metadata.
 *
 * This allows the dashboard to display human-readable operation details
 * for pending multisig proposals.
 */

import type { ApiPromise } from '@polkadot/api';
import { TOKEN_CONFIG, type TokenOperation, type TokenOperationType } from './types';

/**
 * Result of decoding a call
 */
export interface DecodedCall {
	/** Successfully decoded */
	success: boolean;
	/** Pallet name (e.g., "cladToken") */
	palletName?: string;
	/** Call name (e.g., "mint") */
	callName?: string;
	/** Decoded operation with typed parameters */
	operation?: TokenOperation;
	/** Human-readable description */
	description?: string;
	/** Error message if decoding failed */
	error?: string;
}

/**
 * Map of pallet-clad-token call names to operation types
 */
const CLAD_TOKEN_CALL_MAP: Record<string, TokenOperationType> = {
	mint: 'Mint',
	transfer: 'Transfer',
	freeze: 'Freeze',
	unfreeze: 'Unfreeze',
	add_to_whitelist: 'AddToWhitelist',
	remove_from_whitelist: 'RemoveFromWhitelist',
	set_admin: 'SetAdmin'
};

/**
 * Decode a SCALE-encoded call using the connected chain's metadata.
 *
 * @param api - Connected ApiPromise instance
 * @param encodedCall - Hex-encoded call data (0x prefixed)
 * @returns Decoded call information
 */
export function decodeCall(api: ApiPromise, encodedCall: string): DecodedCall {
	try {
		// Remove 0x prefix if present
		const callData = encodedCall.startsWith('0x') ? encodedCall : `0x${encodedCall}`;

		// Decode the call using the registry
		const call = api.createType('Call', callData);

		const palletName = call.section;
		const callName = call.method;

		// Try to parse as a CLAD token operation
		const operation = parseTokenOperation(palletName, callName, call.args);

		// Generate human-readable description
		const description = generateDescription(palletName, callName, operation);

		return {
			success: true,
			palletName,
			callName,
			operation,
			description
		};
	} catch (e) {
		console.debug('Failed to decode call:', e);
		return {
			success: false,
			error: e instanceof Error ? e.message : 'Failed to decode call'
		};
	}
}

/**
 * Parse call arguments into a typed TokenOperation
 */
function parseTokenOperation(palletName: string, callName: string, args: unknown): TokenOperation {
	// Check if this is a cladToken pallet call
	if (palletName === 'cladToken') {
		const opType = CLAD_TOKEN_CALL_MAP[callName];
		if (opType) {
			return parseCladTokenArgs(opType, args);
		}
	}

	// Unknown operation
	return { type: 'Unknown', params: {} };
}

/**
 * Parse cladToken pallet call arguments
 */
function parseCladTokenArgs(opType: TokenOperationType, args: unknown): TokenOperation {
	// Args is typically an array-like object with named properties
	const argsObj = args as Record<string, { toString(): string }>;

	switch (opType) {
		case 'Mint':
			return {
				type: 'Mint',
				params: {
					to: argsObj.to?.toString() || argsObj[0]?.toString(),
					amount: parseAmount(argsObj.amount?.toString() || argsObj[1]?.toString())
				}
			};
		case 'Transfer':
			return {
				type: 'Transfer',
				params: {
					from: argsObj.from?.toString() || argsObj[0]?.toString(),
					to: argsObj.to?.toString() || argsObj[1]?.toString(),
					amount: parseAmount(argsObj.amount?.toString() || argsObj[2]?.toString())
				}
			};
		case 'Freeze':
			return {
				type: 'Freeze',
				params: {
					account: argsObj.account?.toString() || argsObj[0]?.toString()
				}
			};
		case 'Unfreeze':
			return {
				type: 'Unfreeze',
				params: {
					account: argsObj.account?.toString() || argsObj[0]?.toString()
				}
			};
		case 'AddToWhitelist':
			return {
				type: 'AddToWhitelist',
				params: {
					account: argsObj.account?.toString() || argsObj[0]?.toString()
				}
			};
		case 'RemoveFromWhitelist':
			return {
				type: 'RemoveFromWhitelist',
				params: {
					account: argsObj.account?.toString() || argsObj[0]?.toString()
				}
			};
		case 'SetAdmin':
			return {
				type: 'SetAdmin',
				params: {
					newAdmin: argsObj.new_admin?.toString() || argsObj[0]?.toString()
				}
			};
		default:
			return { type: 'Unknown', params: {} };
	}
}

/**
 * Parse amount string to bigint
 */
function parseAmount(amountStr: string | undefined): bigint | undefined {
	if (!amountStr) return undefined;
	try {
		return BigInt(amountStr);
	} catch {
		return undefined;
	}
}

/**
 * Generate a human-readable description of the operation
 */
function generateDescription(
	palletName: string,
	callName: string,
	operation: TokenOperation
): string {
	if (operation.type === 'Unknown') {
		return `${palletName}.${callName}`;
	}

	const formatAddr = (addr: string | undefined) =>
		addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '?';

	const formatAmt = (amt: bigint | undefined) => {
		if (!amt) return '?';
		const divisor = BigInt(10 ** TOKEN_CONFIG.CLAD_DECIMALS);
		const whole = amt / divisor;
		const frac = amt % divisor;
		const fracStr = frac.toString().padStart(TOKEN_CONFIG.CLAD_DECIMALS, '0').slice(0, 2);
		return `${whole.toLocaleString()}.${fracStr}`;
	};

	switch (operation.type) {
		case 'Mint':
			return `Mint ${formatAmt(operation.params.amount)} CLAD to ${formatAddr(operation.params.to)}`;
		case 'Transfer':
			return `Transfer ${formatAmt(operation.params.amount)} CLAD from ${formatAddr(operation.params.from)} to ${formatAddr(operation.params.to)}`;
		case 'Freeze':
			return `Freeze account ${formatAddr(operation.params.account)}`;
		case 'Unfreeze':
			return `Unfreeze account ${formatAddr(operation.params.account)}`;
		case 'AddToWhitelist':
			return `Add ${formatAddr(operation.params.account)} to whitelist`;
		case 'RemoveFromWhitelist':
			return `Remove ${formatAddr(operation.params.account)} from whitelist`;
		case 'SetAdmin':
			return `Set admin to ${formatAddr(operation.params.newAdmin)}`;
		default:
			return `${palletName}.${callName}`;
	}
}
