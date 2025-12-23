/**
 * TypeScript interfaces matching CLAD Server API models
 *
 * These types are derived from the OpenAPI specification at /openapi.json
 * and match the Kotlin data classes in clad-mobile/shared
 */

// ============================================================================
// Enums
// ============================================================================

export type AccountRole = 'ADMIN' | 'ISSUER' | 'INVESTOR' | 'OBSERVER';

export type KycStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';

// ============================================================================
// Core Models
// ============================================================================

/**
 * Multi-sig call data storage
 * Used to store encoded call data for multi-sig operations so other signers
 * can retrieve and verify the full call before approving
 */
export interface CallData {
	/** Blake2-256 hash of the encoded call (0x + 64 hex) */
	callHash: string;
	/** SCALE-encoded call bytes (0x prefixed) */
	encodedCall: string;
	/** Pallet name (e.g., "CladToken") */
	palletName: string;
	/** Call name (e.g., "mint", "addToWhitelist") */
	callName: string;
	/** SS58 address of the proposer */
	createdBy: string;
	/** Unix epoch seconds when created */
	createdAt: number;
	/** Human-readable description */
	description?: string;
}

/**
 * Account metadata for labeling and tracking accounts
 */
export interface AccountMetadata {
	/** SS58-encoded account address */
	address: string;
	/** Human-readable display name */
	displayName: string;
	/** Account role in the system */
	role: AccountRole;
	/** KYC verification status */
	kycStatus: KycStatus;
	/** Unix epoch seconds when KYC expires (if applicable) */
	kycExpiresAt?: number;
	/** Unix epoch seconds when created */
	createdAt: number;
	/** Unix epoch seconds when last updated */
	updatedAt: number;
}

/**
 * Admin multi-sig configuration
 * Stores the signatories, threshold, and derived multi-sig address
 */
export interface AdminMultisigConfig {
	/** Derived multi-sig address (SS58) */
	multisigAddress: string;
	/** Sorted list of signatory SS58 addresses */
	signatories: string[];
	/** Number of approvals required */
	threshold: number;
	/** Optional name for the multi-sig (e.g., "Treasury Committee") */
	name?: string;
	/** Unix epoch seconds when created */
	createdAt: number;
	/** Unix epoch seconds when last updated */
	updatedAt: number;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Request to store call data for a multi-sig operation
 */
export interface CreateCallDataRequest {
	/** Blake2-256 hash of the encoded call (0x + 64 hex) */
	callHash: string;
	/** SCALE-encoded call bytes (0x prefixed) */
	encodedCall: string;
	/** Pallet name (e.g., "CladToken") */
	palletName: string;
	/** Call name (e.g., "mint", "addToWhitelist") */
	callName: string;
	/** SS58 address of the proposer */
	createdBy: string;
	/** Human-readable description */
	description?: string;
}

/**
 * Request to create a new account metadata record
 */
export interface CreateAccountRequest {
	/** SS58-encoded account address */
	address: string;
	/** Human-readable display name */
	displayName: string;
	/** Account role in the system */
	role: AccountRole;
	/** KYC verification status */
	kycStatus: KycStatus;
	/** Unix epoch seconds when KYC expires (if applicable) */
	kycExpiresAt?: number;
}

/**
 * Request to update account metadata (partial update)
 * All fields are optional - only provided fields are updated
 */
export interface UpdateAccountRequest {
	/** Human-readable display name */
	displayName?: string;
	/** Account role in the system */
	role?: AccountRole;
	/** KYC verification status */
	kycStatus?: KycStatus;
	/** Unix epoch seconds when KYC expires */
	kycExpiresAt?: number;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
	/** Whether the request succeeded */
	success: boolean;
	/** Response data (present on success) */
	data?: T;
	/** Error message (present on failure) */
	error?: string;
}

/**
 * Health check response
 */
export interface HealthResponse {
	status: 'ok' | string;
}

// ============================================================================
// Client Types
// ============================================================================

/**
 * Connection state for the CLAD Server client
 */
export type ServerConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Error types that can occur when communicating with the server
 */
export type ApiErrorType =
	| 'network' // Network/connectivity error
	| 'timeout' // Request timed out
	| 'server' // Server returned an error response
	| 'validation' // Client-side validation failed
	| 'not_found' // Resource not found (404)
	| 'unknown'; // Unknown error

/**
 * Structured API error
 */
export interface ApiError {
	type: ApiErrorType;
	message: string;
	status?: number;
}

/**
 * Result type for API operations
 */
export type ApiResult<T> = { success: true; data: T } | { success: false; error: ApiError };
