/**
 * Batch proposal creation service.
 *
 * Handles encoding calls and submitting them to the CLAD Server
 * with progress tracking for batch whitelist operations.
 */

import type { ApiPromise } from '@polkadot/api';
import { createCallData } from '$lib/api';
import { encodeBatchWhitelist } from '$lib/substrate';
import type { CreateCallDataRequest } from '$lib/api/types';

/**
 * Progress callback type
 */
export type ProgressCallback = (current: number, total: number, address: string) => void;

/**
 * Result of creating a single proposal
 */
export interface ProposalResult {
	address: string;
	callHash: string;
	success: boolean;
	error?: string;
}

/**
 * Result of batch proposal creation
 */
export interface BatchResult {
	/** All results */
	results: ProposalResult[];
	/** Number of successful proposals */
	successCount: number;
	/** Number of failed proposals */
	failureCount: number;
	/** Total time in milliseconds */
	elapsedMs: number;
}

/**
 * Create batch whitelist proposals.
 *
 * Encodes each address as an addToWhitelist call and submits to the CLAD Server.
 *
 * @param api - Connected ApiPromise instance
 * @param addresses - Array of SS58 addresses to whitelist
 * @param createdBy - SS58 address of the proposer (for audit trail)
 * @param onProgress - Optional progress callback
 * @returns Batch result with individual proposal outcomes
 */
export async function createBatchWhitelistProposals(
	api: ApiPromise,
	addresses: string[],
	createdBy: string,
	onProgress?: ProgressCallback
): Promise<BatchResult> {
	const startTime = Date.now();
	const results: ProposalResult[] = [];
	let successCount = 0;
	let failureCount = 0;

	// Encode all calls first
	const encodedCalls = encodeBatchWhitelist(api, addresses);

	// Submit each to the server
	for (let i = 0; i < encodedCalls.length; i++) {
		const encoded = encodedCalls[i];

		// Report progress
		if (onProgress) {
			onProgress(i + 1, encodedCalls.length, encoded.address);
		}

		// Create the request
		const request: CreateCallDataRequest = {
			callHash: encoded.callHash,
			encodedCall: encoded.encodedCall,
			palletName: encoded.palletName,
			callName: encoded.callName,
			createdBy,
			description: `Add ${encoded.address} to whitelist`
		};

		// Submit to server
		const result = await createCallData(request);

		if (result.success) {
			results.push({
				address: encoded.address,
				callHash: encoded.callHash,
				success: true
			});
			successCount++;
		} else {
			results.push({
				address: encoded.address,
				callHash: encoded.callHash,
				success: false,
				error: result.error.message
			});
			failureCount++;
		}
	}

	return {
		results,
		successCount,
		failureCount,
		elapsedMs: Date.now() - startTime
	};
}

/**
 * Create a single whitelist proposal.
 *
 * @param api - Connected ApiPromise instance
 * @param address - SS58 address to whitelist
 * @param createdBy - SS58 address of the proposer
 * @returns Result of creating the proposal
 */
export async function createWhitelistProposal(
	api: ApiPromise,
	address: string,
	createdBy: string
): Promise<ProposalResult> {
	const batch = await createBatchWhitelistProposals(api, [address], createdBy);
	return batch.results[0];
}
