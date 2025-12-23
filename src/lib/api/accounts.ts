/**
 * Account endpoint functions
 *
 * Provides access to account metadata management including display names,
 * roles, and KYC status.
 */

import { get, isMockMode, post, put } from './client';
import { mockCreateAccount, mockGetAccount, mockListAccounts, mockUpdateAccount } from './mock';
import type {
	AccountMetadata,
	ApiResult,
	CreateAccountRequest,
	UpdateAccountRequest
} from './types';

const BASE_PATH = '/api/v1/accounts';

/**
 * List all account metadata records
 *
 * @returns All accounts sorted by display name
 */
export async function listAccounts(): Promise<ApiResult<AccountMetadata[]>> {
	if (isMockMode()) {
		return mockListAccounts();
	}
	return get<AccountMetadata[]>(BASE_PATH);
}

/**
 * Get account metadata by SS58 address
 *
 * @param address - SS58-encoded account address
 * @returns Account metadata, or not_found error if not exists
 */
export async function getAccount(address: string): Promise<ApiResult<AccountMetadata>> {
	if (isMockMode()) {
		return mockGetAccount(address);
	}
	return get<AccountMetadata>(`${BASE_PATH}/${encodeURIComponent(address)}`);
}

/**
 * Create a new account metadata record
 *
 * @param request - Account creation data
 * @returns The created account with server-generated timestamps
 */
export async function createAccount(
	request: CreateAccountRequest
): Promise<ApiResult<AccountMetadata>> {
	if (isMockMode()) {
		return mockCreateAccount(request);
	}
	return post<AccountMetadata>(BASE_PATH, request);
}

/**
 * Update account metadata (partial update)
 * Only provided fields are updated.
 *
 * @param address - SS58-encoded account address
 * @param request - Fields to update
 * @returns The updated account
 */
export async function updateAccount(
	address: string,
	request: UpdateAccountRequest
): Promise<ApiResult<AccountMetadata>> {
	if (isMockMode()) {
		return mockUpdateAccount(address, request);
	}
	return put<AccountMetadata>(`${BASE_PATH}/${encodeURIComponent(address)}`, request);
}
