/**
 * CLAD Server API Client
 *
 * This module provides HTTP client infrastructure for communicating with
 * the CLAD Server backend. It includes:
 *
 * - Base client with connection state management
 * - TypeScript interfaces matching server models
 * - Endpoint functions for CallData, Accounts, and AdminConfig
 * - Mock mode for development without a running server
 *
 * @example
 * ```typescript
 * import { initializeClient, checkHealth, listAccounts } from '$lib/api';
 *
 * // Initialize on app startup
 * initializeClient();
 *
 * // Check server health
 * const health = await checkHealth();
 *
 * // List all accounts
 * const result = await listAccounts();
 * if (result.success) {
 *   console.log(result.data);
 * }
 * ```
 */

// Client functions
export {
	initializeClient,
	getServerUrl,
	setServerUrl,
	getDefaultServerUrl,
	subscribeToServerState,
	getServerConnectionState,
	checkHealth,
	testServerConnection,
	resetConnectionState,
	isMockMode
} from './client';

// CallData endpoints
export { createCallData, getCallData, isValidCallHash, isValidEncodedCall } from './call-data';

// Account endpoints
export { listAccounts, getAccount, createAccount, updateAccount } from './accounts';

// Admin Config endpoints
export { getAdminConfig } from './admin-config';

// Types
export type {
	// Enums
	AccountRole,
	KycStatus,
	// Core Models
	CallData,
	AccountMetadata,
	AdminMultisigConfig,
	// Request Types
	CreateCallDataRequest,
	CreateAccountRequest,
	UpdateAccountRequest,
	// Response Types
	ApiResponse,
	HealthResponse,
	// Client Types
	ServerConnectionState,
	ApiErrorType,
	ApiError,
	ApiResult
} from './types';
