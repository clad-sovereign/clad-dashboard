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
	id: string;
	type: CladTokenEventType;
	blockNumber: number;
	blockHash: string;
	timestamp: number | null;
	data: Record<string, unknown>;
}

/**
 * Timepoint for multisig operations
 */
export interface MultisigTimepoint {
	height: number;
	index: number;
}

/**
 * Multi-sig approval info (from storage)
 */
export interface MultisigInfo {
	threshold: number;
	signatories: string[];
	approvals: string[];
	callHash: string;
	when: MultisigTimepoint;
}

/**
 * Token operation types that can be proposed via multisig
 */
export type TokenOperationType =
	| 'Mint'
	| 'Transfer'
	| 'Freeze'
	| 'Unfreeze'
	| 'AddToWhitelist'
	| 'RemoveFromWhitelist'
	| 'SetAdmin'
	| 'Unknown';

/**
 * Decoded token operation from call data
 */
export interface TokenOperation {
	type: TokenOperationType;
	params: {
		to?: string;
		from?: string;
		account?: string;
		amount?: bigint;
		newAdmin?: string;
	};
}

/**
 * A pending multisig proposal
 */
export interface PendingProposal {
	id: string;
	multisigAccount: string;
	callHash: string;
	operation: TokenOperation;
	depositor: string;
	deposit: bigint;
	approvals: string[];
	threshold: number;
	signatories: string[];
	when: MultisigTimepoint;
	timestamp: number | null;
}

/**
 * Admin account type
 */
export type AdminType = 'root' | 'multisig' | 'unknown';

/**
 * Admin status information
 */
export interface AdminStatus {
	/** Whether an admin is set */
	hasAdmin: boolean;
	/** The admin account address (SS58) */
	address: string | null;
	/** Type of admin (root for dev, multisig for production) */
	type: AdminType;
	/** If multisig, the configuration details */
	multisigConfig?: {
		name: string;
		threshold: number;
		signatories: Array<{ address: string; name?: string }>;
	};
}

/**
 * Token configuration constants
 * These should match the values in clad-mobile's TokenConfig.kt
 */
export const TOKEN_CONFIG = {
	/** Native token decimals (for fees) - clad-node uses 12 */
	NATIVE_DECIMALS: 12,
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
