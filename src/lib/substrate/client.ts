/**
 * Substrate client for connecting to clad-node
 *
 * This module provides a singleton ApiPromise instance for interacting
 * with the Clad blockchain node via WebSocket RPC.
 */

import { ApiPromise, WsProvider } from '@polkadot/api';

// Import type augmentations for chain-specific types
// This provides compile-time type safety for storage queries
import './interfaces';

// Default endpoint for local development
const DEFAULT_ENDPOINT = 'ws://127.0.0.1:9944';

// Connection state
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Singleton instance
let apiInstance: ApiPromise | null = null;
let connectionState: ConnectionState = 'disconnected';
let connectionError: string | null = null;

// Subscribers to connection state changes
type StateListener = (state: ConnectionState, error?: string) => void;
const listeners: Set<StateListener> = new Set();

function notifyListeners() {
	listeners.forEach((listener) => listener(connectionState, connectionError ?? undefined));
}

/**
 * Subscribe to connection state changes
 */
export function subscribeToConnectionState(listener: StateListener): () => void {
	listeners.add(listener);
	// Immediately notify with current state
	listener(connectionState, connectionError ?? undefined);
	// Return unsubscribe function
	return () => listeners.delete(listener);
}

/**
 * Get current connection state
 */
export function getConnectionState(): { state: ConnectionState; error: string | null } {
	return { state: connectionState, error: connectionError };
}

/**
 * Connect to the Substrate node
 */
export async function connect(endpoint: string = DEFAULT_ENDPOINT): Promise<ApiPromise> {
	// If already connected to same endpoint, return existing instance
	if (apiInstance && connectionState === 'connected') {
		return apiInstance;
	}

	// If currently connecting, wait for it
	if (connectionState === 'connecting' && apiInstance) {
		await apiInstance.isReady;
		return apiInstance;
	}

	connectionState = 'connecting';
	connectionError = null;
	notifyListeners();

	try {
		const provider = new WsProvider(endpoint);

		// Handle provider events
		provider.on('connected', () => {
			connectionState = 'connected';
			connectionError = null;
			notifyListeners();
		});

		provider.on('disconnected', () => {
			connectionState = 'disconnected';
			notifyListeners();
		});

		provider.on('error', (error) => {
			connectionState = 'error';
			connectionError = error?.message || 'Unknown connection error';
			notifyListeners();
		});

		apiInstance = await ApiPromise.create({ provider });
		await apiInstance.isReady;

		connectionState = 'connected';
		notifyListeners();

		return apiInstance;
	} catch (error) {
		connectionState = 'error';
		connectionError = error instanceof Error ? error.message : 'Failed to connect';
		notifyListeners();
		throw error;
	}
}

/**
 * Disconnect from the Substrate node
 */
export async function disconnect(): Promise<void> {
	if (apiInstance) {
		await apiInstance.disconnect();
		apiInstance = null;
		connectionState = 'disconnected';
		connectionError = null;
		notifyListeners();
	}
}

/**
 * Get the current API instance (throws if not connected)
 */
export function getApi(): ApiPromise {
	if (!apiInstance || connectionState !== 'connected') {
		throw new Error('Not connected to Substrate node. Call connect() first.');
	}
	return apiInstance;
}

/**
 * Get the current API instance or null if not connected
 */
export function getApiOrNull(): ApiPromise | null {
	return connectionState === 'connected' ? apiInstance : null;
}

/**
 * Test connection to an endpoint without affecting the main connection.
 * Returns true if connection succeeds within the timeout, false otherwise.
 * This is useful for validating an endpoint before saving it.
 */
export async function testConnection(
	endpoint: string,
	timeoutMs: number = 10000
): Promise<{ success: boolean; error?: string }> {
	return new Promise((resolve) => {
		let resolved = false;
		let testProvider: WsProvider | null = null;
		let websocket: WebSocket | null = null;

		const cleanup = async () => {
			// Close the raw websocket first to prevent any more events
			if (websocket) {
				try {
					websocket.close();
				} catch {
					// Ignore errors
				}
				websocket = null;
			}
			if (testProvider) {
				try {
					await testProvider.disconnect();
				} catch {
					// Ignore errors
				}
				testProvider = null;
			}
		};

		const finalize = (result: { success: boolean; error?: string }) => {
			if (!resolved) {
				resolved = true;
				cleanup();
				resolve(result);
			}
		};

		const timeoutId = setTimeout(() => {
			finalize({ success: false, error: 'Connection timed out' });
		}, timeoutMs);

		try {
			// Use raw WebSocket for testing - much cleaner than WsProvider
			// WsProvider has complex retry logic that's hard to cancel
			websocket = new WebSocket(endpoint);

			websocket.onopen = () => {
				clearTimeout(timeoutId);
				finalize({ success: true });
			};

			websocket.onerror = () => {
				clearTimeout(timeoutId);
				finalize({ success: false, error: 'Connection failed' });
			};

			websocket.onclose = (event) => {
				// Only treat as error if we haven't resolved yet
				if (!resolved) {
					clearTimeout(timeoutId);
					finalize({
						success: false,
						error: event.wasClean ? 'Connection closed' : 'Connection failed'
					});
				}
			};
		} catch (error) {
			clearTimeout(timeoutId);
			finalize({
				success: false,
				error: error instanceof Error ? error.message : 'Connection failed'
			});
		}
	});
}
