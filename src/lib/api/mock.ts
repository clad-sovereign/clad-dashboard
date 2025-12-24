/**
 * Mock data and handlers for development without a running server
 *
 * Enabled via PUBLIC_MOCK_API=true environment variable
 */

import type {
	AccountMetadata,
	AdminMultisigConfig,
	ApiResult,
	CallData,
	CreateAccountRequest,
	CreateCallDataRequest,
	HealthResponse,
	UpdateAccountRequest
} from './types';

// ============================================================================
// Mock Data Store
// ============================================================================

// In-memory storage for mock data
const mockCallData: Map<string, CallData> = new Map();
const mockAccounts: Map<string, AccountMetadata> = new Map();
let mockAdminConfig: AdminMultisigConfig | null = null;

// Simulated network delay (ms)
const MOCK_DELAY_MS = 100;

/**
 * Simulate network delay
 */
async function delay(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));
}

// ============================================================================
// Initialize Mock Data
// ============================================================================

/**
 * Initialize mock data with sample accounts and config
 */
export function initializeMockData(): void {
	const now = Math.floor(Date.now() / 1000);

	// Sample accounts (using well-known dev addresses)
	const sampleAccounts: AccountMetadata[] = [
		{
			address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
			displayName: 'Alice',
			role: 'ADMIN',
			kycStatus: 'VERIFIED',
			createdAt: now - 86400,
			updatedAt: now - 3600
		},
		{
			address: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
			displayName: 'Bob',
			role: 'ADMIN',
			kycStatus: 'VERIFIED',
			createdAt: now - 86400,
			updatedAt: now - 7200
		},
		{
			address: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y',
			displayName: 'Charlie',
			role: 'ISSUER',
			kycStatus: 'VERIFIED',
			createdAt: now - 43200,
			updatedAt: now - 43200
		},
		{
			address: '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy',
			displayName: 'Dave',
			role: 'INVESTOR',
			kycStatus: 'PENDING',
			createdAt: now - 3600,
			updatedAt: now - 3600
		}
	];

	for (const account of sampleAccounts) {
		mockAccounts.set(account.address, account);
	}

	// Sample admin multi-sig config
	// Note: This is the actual derived multisig address for Alice+Bob+Charlie with threshold=2
	mockAdminConfig = {
		multisigAddress: '5DjYJStmdZ2rcqXbXGX7TW85JsrW6uG4y9MUcLq2BoPMpRA7',
		signatories: [
			'5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
			'5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
			'5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y'
		],
		threshold: 2,
		name: 'Treasury Committee',
		createdAt: now - 86400,
		updatedAt: now - 86400
	};

	// Sample call data
	const sampleCallData: CallData = {
		callHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
		encodedCall: '0x0800',
		palletName: 'CladToken',
		callName: 'mint',
		createdBy: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
		createdAt: now - 1800,
		description: 'Mint 1000 CLAD tokens to Treasury'
	};
	mockCallData.set(sampleCallData.callHash, sampleCallData);
}

// ============================================================================
// Mock Handlers
// ============================================================================

/**
 * Mock health check
 */
export async function mockCheckHealth(): Promise<ApiResult<HealthResponse>> {
	await delay();
	return { success: true, data: { status: 'ok' } };
}

/**
 * Mock create call data
 */
export async function mockCreateCallData(
	request: CreateCallDataRequest
): Promise<ApiResult<CallData>> {
	await delay();

	const now = Math.floor(Date.now() / 1000);
	const callData: CallData = {
		...request,
		createdAt: now
	};

	mockCallData.set(callData.callHash, callData);
	return { success: true, data: callData };
}

/**
 * Mock get call data
 */
export async function mockGetCallData(callHash: string): Promise<ApiResult<CallData>> {
	await delay();

	const data = mockCallData.get(callHash);
	if (!data) {
		return {
			success: false,
			error: { type: 'not_found', message: 'Call data not found', status: 404 }
		};
	}

	return { success: true, data };
}

/**
 * Mock list call data
 */
export async function mockListCallData(): Promise<ApiResult<CallData[]>> {
	await delay();

	const data = Array.from(mockCallData.values()).sort((a, b) => b.createdAt - a.createdAt);

	return { success: true, data };
}

/**
 * Mock list accounts
 */
export async function mockListAccounts(): Promise<ApiResult<AccountMetadata[]>> {
	await delay();

	const accounts = Array.from(mockAccounts.values()).sort((a, b) =>
		a.displayName.localeCompare(b.displayName)
	);

	return { success: true, data: accounts };
}

/**
 * Mock get account
 */
export async function mockGetAccount(address: string): Promise<ApiResult<AccountMetadata>> {
	await delay();

	const account = mockAccounts.get(address);
	if (!account) {
		return {
			success: false,
			error: { type: 'not_found', message: 'Account not found', status: 404 }
		};
	}

	return { success: true, data: account };
}

/**
 * Mock create account
 */
export async function mockCreateAccount(
	request: CreateAccountRequest
): Promise<ApiResult<AccountMetadata>> {
	await delay();

	if (mockAccounts.has(request.address)) {
		return {
			success: false,
			error: { type: 'validation', message: 'Account already exists', status: 400 }
		};
	}

	const now = Math.floor(Date.now() / 1000);
	const account: AccountMetadata = {
		...request,
		createdAt: now,
		updatedAt: now
	};

	mockAccounts.set(account.address, account);
	return { success: true, data: account };
}

/**
 * Mock update account
 */
export async function mockUpdateAccount(
	address: string,
	request: UpdateAccountRequest
): Promise<ApiResult<AccountMetadata>> {
	await delay();

	const existing = mockAccounts.get(address);
	if (!existing) {
		return {
			success: false,
			error: { type: 'not_found', message: 'Account not found', status: 404 }
		};
	}

	const now = Math.floor(Date.now() / 1000);
	const updated: AccountMetadata = {
		...existing,
		...(request.displayName !== undefined && { displayName: request.displayName }),
		...(request.role !== undefined && { role: request.role }),
		...(request.kycStatus !== undefined && { kycStatus: request.kycStatus }),
		...(request.kycExpiresAt !== undefined && { kycExpiresAt: request.kycExpiresAt }),
		updatedAt: now
	};

	mockAccounts.set(address, updated);
	return { success: true, data: updated };
}

/**
 * Mock get admin config
 */
export async function mockGetAdminConfig(): Promise<ApiResult<AdminMultisigConfig>> {
	await delay();

	if (!mockAdminConfig) {
		return {
			success: false,
			error: { type: 'not_found', message: 'Admin config not found', status: 404 }
		};
	}

	return { success: true, data: mockAdminConfig };
}
