/**
 * CallData endpoint functions
 *
 * Provides access to multi-sig call data storage for pallet-multisig coordination.
 * Call data is stored by its Blake2-256 hash, allowing signers to retrieve and
 * verify the full call before approving.
 */

import { get, isMockMode, post } from './client';
import { mockCreateCallData, mockGetCallData, mockListCallData } from './mock';
import type { ApiResult, CallData, CreateCallDataRequest } from './types';

const BASE_PATH = '/api/v1/call-data';

/**
 * List all stored call data
 *
 * @returns Array of all call data, sorted by creation time (newest first)
 */
export async function listCallData(): Promise<ApiResult<CallData[]>> {
	if (isMockMode()) {
		return mockListCallData();
	}
	return get<CallData[]>(BASE_PATH);
}

/**
 * Store call data for a multi-sig operation
 *
 * @param request - Call data to store
 * @returns The stored call data with server-generated timestamps
 */
export async function createCallData(request: CreateCallDataRequest): Promise<ApiResult<CallData>> {
	if (isMockMode()) {
		return mockCreateCallData(request);
	}
	return post<CallData>(BASE_PATH, request);
}

/**
 * Retrieve call data by its Blake2-256 hash
 *
 * @param callHash - Blake2-256 hash of the encoded call (0x + 64 hex)
 * @returns The stored call data, or not_found error if not exists
 */
export async function getCallData(callHash: string): Promise<ApiResult<CallData>> {
	if (isMockMode()) {
		return mockGetCallData(callHash);
	}
	return get<CallData>(`${BASE_PATH}/${encodeURIComponent(callHash)}`);
}

/**
 * Validate call hash format (0x + 64 hex characters)
 */
export function isValidCallHash(hash: string): boolean {
	return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

/**
 * Validate encoded call format (0x + hex string)
 */
export function isValidEncodedCall(encoded: string): boolean {
	return /^0x[a-fA-F0-9]+$/.test(encoded);
}
