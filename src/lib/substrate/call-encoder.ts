/**
 * Utility for encoding Substrate calls and computing call hashes.
 *
 * Used to prepare addToWhitelist calls for batch proposal creation.
 * The encoded call and its Blake2-256 hash are stored on the CLAD Server.
 */

import type { ApiPromise } from '@polkadot/api';
import { blake2AsHex } from '@polkadot/util-crypto';

/**
 * Encoded call data with hash
 */
export interface EncodedCall {
	/** The address being whitelisted */
	address: string;
	/** SCALE-encoded call bytes (0x prefixed) */
	encodedCall: string;
	/** Blake2-256 hash of the encoded call (0x + 64 hex) */
	callHash: string;
	/** Pallet name */
	palletName: string;
	/** Call name */
	callName: string;
}

/**
 * Encode a cladToken.addToWhitelist call.
 *
 * @param api - Connected ApiPromise instance
 * @param address - SS58 address to whitelist
 * @returns Encoded call data with hash
 */
export function encodeAddToWhitelist(api: ApiPromise, address: string): EncodedCall {
	// Create the call using the API
	const call = api.tx.cladToken.addToWhitelist(address);

	// Get the encoded call data
	const encodedCall = call.method.toHex();

	// Compute the Blake2-256 hash of the encoded call
	const callHash = blake2AsHex(call.method.toU8a(), 256);

	return {
		address,
		encodedCall,
		callHash,
		palletName: 'CladToken',
		callName: 'addToWhitelist'
	};
}

/**
 * Encode multiple addToWhitelist calls.
 *
 * @param api - Connected ApiPromise instance
 * @param addresses - Array of SS58 addresses to whitelist
 * @returns Array of encoded call data with hashes
 */
export function encodeBatchWhitelist(api: ApiPromise, addresses: string[]): EncodedCall[] {
	return addresses.map((address) => encodeAddToWhitelist(api, address));
}

/**
 * Verify a call hash matches the expected value for a given encoded call.
 *
 * @param encodedCall - SCALE-encoded call bytes (0x prefixed)
 * @param expectedHash - Expected Blake2-256 hash (0x + 64 hex)
 * @returns true if the hash matches
 */
export function verifyCallHash(encodedCall: string, expectedHash: string): boolean {
	const computedHash = blake2AsHex(encodedCall, 256);
	return computedHash.toLowerCase() === expectedHash.toLowerCase();
}
