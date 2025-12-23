/**
 * Base HTTP client for CLAD Server communication
 *
 * Provides a singleton client with connection state management,
 * error handling, and mock mode support.
 *
 * Mock mode can be enabled via PUBLIC_MOCK_API=true environment variable.
 */

import { browser } from '$app/environment';
import { env } from '$env/dynamic/public';
import type {
	ApiError,
	ApiErrorType,
	ApiResponse,
	ApiResult,
	HealthResponse,
	ServerConnectionState
} from './types';
import { initializeMockData, mockCheckHealth } from './mock';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_SERVER_URL = 'http://localhost:8080';
const STORAGE_KEY = 'clad-dashboard-server-url';
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Check if mock mode is enabled
 */
export function isMockMode(): boolean {
	return env.PUBLIC_MOCK_API === 'true';
}

// ============================================================================
// State
// ============================================================================

let serverUrl: string = DEFAULT_SERVER_URL;
let connectionState: ServerConnectionState = 'disconnected';
let connectionError: string | null = null;
let lastHealthCheck: number | null = null;

// Subscribers to connection state changes
type StateListener = (state: ServerConnectionState, error?: string) => void;
const listeners: Set<StateListener> = new Set();

function notifyListeners() {
	listeners.forEach((listener) => listener(connectionState, connectionError ?? undefined));
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Initialize the client with stored server URL
 * Call this on app startup (e.g., in +layout.svelte)
 */
export function initializeClient(): void {
	if (browser) {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			serverUrl = stored;
		}
	}

	// Initialize mock data if in mock mode
	if (isMockMode()) {
		initializeMockData();
		// Set connected state immediately in mock mode
		connectionState = 'connected';
		lastHealthCheck = Date.now();
	}
}

/**
 * Get the current server URL
 */
export function getServerUrl(): string {
	return serverUrl;
}

/**
 * Set the server URL and persist to localStorage
 */
export function setServerUrl(url: string): void {
	serverUrl = url;
	if (browser) {
		localStorage.setItem(STORAGE_KEY, url);
	}
	// Reset connection state when URL changes
	connectionState = 'disconnected';
	connectionError = null;
	lastHealthCheck = null;
	notifyListeners();
}

/**
 * Get the default server URL
 */
export function getDefaultServerUrl(): string {
	return DEFAULT_SERVER_URL;
}

// ============================================================================
// Connection State
// ============================================================================

/**
 * Subscribe to connection state changes
 */
export function subscribeToServerState(listener: StateListener): () => void {
	listeners.add(listener);
	// Immediately notify with current state
	listener(connectionState, connectionError ?? undefined);
	return () => listeners.delete(listener);
}

/**
 * Get current connection state
 */
export function getServerConnectionState(): {
	state: ServerConnectionState;
	error: string | null;
	lastCheck: number | null;
} {
	return { state: connectionState, error: connectionError, lastCheck: lastHealthCheck };
}

/**
 * Update connection state
 */
function setConnectionState(state: ServerConnectionState, error?: string): void {
	connectionState = state;
	connectionError = error ?? null;
	if (state === 'connected') {
		lastHealthCheck = Date.now();
	}
	notifyListeners();
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * Create an ApiError from various error sources
 */
function createApiError(error: unknown, defaultType: ApiErrorType = 'unknown'): ApiError {
	if (error instanceof TypeError && error.message.includes('fetch')) {
		return { type: 'network', message: 'Unable to connect to server' };
	}

	if (error instanceof DOMException && error.name === 'AbortError') {
		return { type: 'timeout', message: 'Request timed out' };
	}

	if (error instanceof Error) {
		return { type: defaultType, message: error.message };
	}

	return { type: 'unknown', message: 'An unknown error occurred' };
}

/**
 * Create an ApiError from an HTTP response
 */
function createHttpError(status: number, message: string): ApiError {
	if (status === 404) {
		return { type: 'not_found', message, status };
	}
	if (status >= 400 && status < 500) {
		return { type: 'validation', message, status };
	}
	return { type: 'server', message, status };
}

// ============================================================================
// HTTP Methods
// ============================================================================

/**
 * Make an HTTP request with timeout and error handling
 */
async function request<T>(
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	path: string,
	body?: unknown
): Promise<ApiResult<T>> {
	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	try {
		const response = await fetch(`${serverUrl}${path}`, {
			method,
			headers: {
				'Content-Type': 'application/json',
				Accept: 'application/json'
			},
			body: body ? JSON.stringify(body) : undefined,
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		// Parse JSON response
		const json = (await response.json()) as ApiResponse<T>;

		if (!response.ok || !json.success) {
			const error = createHttpError(
				response.status,
				json.error || `Request failed with status ${response.status}`
			);
			return { success: false, error };
		}

		return { success: true, data: json.data as T };
	} catch (error) {
		clearTimeout(timeoutId);
		return { success: false, error: createApiError(error) };
	}
}

/**
 * GET request
 */
export async function get<T>(path: string): Promise<ApiResult<T>> {
	return request<T>('GET', path);
}

/**
 * POST request
 */
export async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
	return request<T>('POST', path, body);
}

/**
 * PUT request
 */
export async function put<T>(path: string, body: unknown): Promise<ApiResult<T>> {
	return request<T>('PUT', path, body);
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Check server health and update connection state
 */
export async function checkHealth(): Promise<ApiResult<HealthResponse>> {
	// In mock mode, always return success
	if (isMockMode()) {
		setConnectionState('connected');
		return mockCheckHealth();
	}

	setConnectionState('connecting');

	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		const response = await fetch(`${serverUrl}/health`, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			const error = createHttpError(response.status, `Health check failed: ${response.status}`);
			setConnectionState('error', error.message);
			return { success: false, error };
		}

		const data = (await response.json()) as HealthResponse;

		if (data.status === 'ok') {
			setConnectionState('connected');
			return { success: true, data };
		}

		setConnectionState('error', `Unexpected health status: ${data.status}`);
		return {
			success: false,
			error: { type: 'server', message: `Unexpected health status: ${data.status}` }
		};
	} catch (error) {
		const apiError = createApiError(error, 'network');
		setConnectionState('error', apiError.message);
		return { success: false, error: apiError };
	}
}

/**
 * Test connection to a specific URL without affecting stored state
 */
export async function testServerConnection(
	url: string,
	timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<{ success: boolean; error?: string }> {
	try {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		const response = await fetch(`${url}/health`, {
			method: 'GET',
			headers: { Accept: 'application/json' },
			signal: controller.signal
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			return { success: false, error: `Server returned ${response.status}` };
		}

		const data = (await response.json()) as HealthResponse;

		if (data.status === 'ok') {
			return { success: true };
		}

		return { success: false, error: `Unexpected status: ${data.status}` };
	} catch (error) {
		if (error instanceof DOMException && error.name === 'AbortError') {
			return { success: false, error: 'Connection timed out' };
		}
		if (error instanceof TypeError) {
			return { success: false, error: 'Unable to connect to server' };
		}
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Connection failed'
		};
	}
}

/**
 * Reset connection state (e.g., when navigating away)
 */
export function resetConnectionState(): void {
	connectionState = 'disconnected';
	connectionError = null;
	notifyListeners();
}
