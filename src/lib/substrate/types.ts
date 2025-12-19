/**
 * Type definitions for Clad token pallet data
 *
 * These types mirror the storage items in pallet-clad-token
 */

import type { u128 } from '@polkadot/types';

/**
 * Token metadata from the chain
 */
export interface TokenMetadata {
	name: string;
	symbol: string;
	decimals: number;
	totalSupply: bigint;
}

/**
 * Account balance information
 */
export interface AccountBalance {
	address: string;
	balance: bigint;
	frozen: boolean;
	whitelisted: boolean;
}

/**
 * Chain information
 */
export interface ChainInfo {
	chainName: string;
	nodeName: string;
	nodeVersion: string;
	genesisHash: string;
	ss58Format: number;
}

/**
 * Block information
 */
export interface BlockInfo {
	number: number;
	hash: string;
	parentHash: string;
	timestamp: number | null;
}

/**
 * Clad token event types from pallet-clad-token
 */
export type CladTokenEventType =
	| 'Minted'
	| 'Transferred'
	| 'Frozen'
	| 'Unfrozen'
	| 'Whitelisted'
	| 'RemovedFromWhitelist';

/**
 * A token event from the chain
 */
export interface TokenEvent {
	type: CladTokenEventType;
	blockNumber: number;
	blockHash: string;
	timestamp: number | null;
	data: Record<string, unknown>;
}

/**
 * Multi-sig approval info
 */
export interface MultisigInfo {
	threshold: number;
	signatories: string[];
	approvals: string[];
	callHash: string;
	when: {
		height: number;
		index: number;
	};
}

/**
 * Token configuration constants
 * These should match the values in clad-mobile's TokenConfig.kt
 */
export const TOKEN_CONFIG = {
	/** Native token decimals (for fees) */
	NATIVE_DECIMALS: 18,
	/** CLAD token decimals (RWA standard) */
	CLAD_DECIMALS: 6,
	/** Pallet index for pallet-clad-token */
	PALLET_INDEX: 8
} as const;

/**
 * Format a raw balance to human-readable string
 */
export function formatBalance(rawBalance: bigint | u128, decimals: number): string {
	const balance = typeof rawBalance === 'bigint' ? rawBalance : BigInt(rawBalance.toString());
	const divisor = BigInt(10 ** decimals);
	const integerPart = balance / divisor;
	const fractionalPart = balance % divisor;

	const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
	// Trim trailing zeros but keep at least 2 decimal places for readability
	const trimmedFractional = fractionalStr.replace(/0+$/, '').padEnd(2, '0');

	return `${integerPart.toLocaleString()}.${trimmedFractional}`;
}

/**
 * Format an SS58 address for display (truncated)
 */
export function formatAddress(address: string, chars: number = 6): string {
	if (address.length <= chars * 2 + 3) return address;
	return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}
