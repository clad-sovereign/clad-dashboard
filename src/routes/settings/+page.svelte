<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		subscribeToConnectionState,
		connect,
		disconnect,
		testConnection as testEndpointConnection,
		type ConnectionState
	} from '$lib/substrate';
	import { StatusDot } from '$lib/components';

	const DEFAULT_ENDPOINT = 'ws://127.0.0.1:9944';
	const STORAGE_KEY = 'clad-dashboard-endpoint';
	const BANNER_TIMEOUT_MS = 5000;

	// Connection state
	let connectionState: ConnectionState = $state('disconnected');
	let connectionError: string | null = $state(null);
	let unsubscribeState: (() => void) | null = null;
	let bannerTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Form state
	let endpointInput = $state(DEFAULT_ENDPOINT);
	let savedEndpoint = $state(DEFAULT_ENDPOINT);
	let isTesting = $state(false);
	let isSaving = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);

	/**
	 * Set test result with auto-dismiss for success messages
	 */
	function setTestResult(result: { success: boolean; message: string }) {
		// Clear any existing timeout
		if (bannerTimeoutId) {
			clearTimeout(bannerTimeoutId);
			bannerTimeoutId = null;
		}

		testResult = result;

		// Auto-dismiss success messages after timeout
		if (result.success) {
			bannerTimeoutId = setTimeout(() => {
				testResult = null;
				bannerTimeoutId = null;
			}, BANNER_TIMEOUT_MS);
		}
	}

	/**
	 * Dismiss the banner manually
	 */
	function dismissBanner() {
		if (bannerTimeoutId) {
			clearTimeout(bannerTimeoutId);
			bannerTimeoutId = null;
		}
		testResult = null;
	}

	// Derived states
	let hasUnsavedChanges = $derived(endpointInput !== savedEndpoint);
	let isValidEndpoint = $derived(
		endpointInput.startsWith('ws://') || endpointInput.startsWith('wss://')
	);

	onMount(() => {
		// Load saved endpoint from localStorage
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			endpointInput = stored;
			savedEndpoint = stored;
		}

		// Subscribe to connection state
		unsubscribeState = subscribeToConnectionState((state, error) => {
			connectionState = state;
			connectionError = error ?? null;
		});
	});

	onDestroy(() => {
		if (unsubscribeState) unsubscribeState();
		if (bannerTimeoutId) clearTimeout(bannerTimeoutId);
	});

	/**
	 * Test connection to the endpoint (without affecting main connection)
	 */
	async function testConnection() {
		if (!isValidEndpoint) {
			setTestResult({
				success: false,
				message: 'Invalid endpoint URL. Must start with ws:// or wss://'
			});
			return;
		}

		isTesting = true;
		testResult = null;

		// Use the dedicated test function with 10s timeout
		const result = await testEndpointConnection(endpointInput, 10000);

		if (result.success) {
			setTestResult({ success: true, message: 'Connection successful!' });
		} else {
			setTestResult({
				success: false,
				message: result.error || 'Connection failed'
			});
		}

		isTesting = false;
	}

	/**
	 * Save the endpoint to localStorage and reconnect
	 */
	async function saveEndpoint() {
		if (!isValidEndpoint) return;

		isSaving = true;
		testResult = null;

		try {
			// Save to localStorage
			localStorage.setItem(STORAGE_KEY, endpointInput);
			savedEndpoint = endpointInput;

			// Reconnect with new endpoint
			await disconnect();
			await connect(endpointInput);

			setTestResult({ success: true, message: 'Settings saved and connected!' });
		} catch (error) {
			setTestResult({
				success: false,
				message: error instanceof Error ? error.message : 'Failed to connect after saving'
			});
		} finally {
			isSaving = false;
		}
	}

	/**
	 * Reset to default endpoint
	 */
	async function resetToDefault() {
		endpointInput = DEFAULT_ENDPOINT;
		testResult = null;

		// Save and reconnect
		isSaving = true;
		try {
			localStorage.setItem(STORAGE_KEY, DEFAULT_ENDPOINT);
			savedEndpoint = DEFAULT_ENDPOINT;
			await disconnect();
			await connect(DEFAULT_ENDPOINT);
			setTestResult({ success: true, message: 'Reset to default and connected!' });
		} catch (error) {
			setTestResult({
				success: false,
				message: error instanceof Error ? error.message : 'Failed to connect to default endpoint'
			});
		} finally {
			isSaving = false;
		}
	}

	/**
	 * Get connection status display
	 */
	function getStatusDisplay(state: ConnectionState): { label: string; class: string } {
		switch (state) {
			case 'connected':
				return { label: 'Connected', class: 'badge-success' };
			case 'connecting':
				return { label: 'Connecting...', class: 'badge-warning' };
			case 'error':
				return { label: 'Error', class: 'badge-error' };
			default:
				return { label: 'Disconnected', class: 'badge-error' };
		}
	}

	let statusDisplay = $derived(getStatusDisplay(connectionState));
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="font-serif text-2xl text-[var(--color-navy)]">Settings</h1>
		<p class="mt-1 text-sm text-[var(--color-text-muted)]">
			Configure dashboard connection and preferences
		</p>
	</div>

	<!-- Connection Status Card -->
	<div class="card">
		<h2 class="text-lg font-medium text-[var(--color-navy)]">Connection Status</h2>
		<div class="mt-4 flex items-center gap-4">
			<div class="flex items-center gap-2">
				<StatusDot status={connectionState} />
				<span class="badge {statusDisplay.class}">{statusDisplay.label}</span>
			</div>
			{#if connectionError}
				<span class="text-sm text-[var(--color-error)]">{connectionError}</span>
			{/if}
		</div>
		{#if connectionState === 'connected'}
			<p class="mt-2 text-sm text-[var(--color-slate-light)]">
				Connected to: <code class="font-mono text-[var(--color-navy)]">{savedEndpoint}</code>
			</p>
		{/if}
	</div>

	<!-- Node Endpoint Configuration -->
	<div class="card">
		<h2 class="text-lg font-medium text-[var(--color-navy)]">Node Endpoint</h2>
		<p class="mt-1 text-sm text-[var(--color-slate-light)]">
			Configure the WebSocket URL for your Substrate node
		</p>

		<div class="mt-4 space-y-4">
			<!-- Endpoint Input -->
			<div>
				<label for="endpoint" class="block text-sm font-medium text-[var(--color-slate)]">
					WebSocket URL
				</label>
				<div class="mt-2 flex gap-2">
					<input
						type="text"
						id="endpoint"
						bind:value={endpointInput}
						placeholder="ws://127.0.0.1:9944"
						class="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-sm placeholder:text-[var(--color-slate-light)] focus:border-[var(--color-navy)] focus:ring-1 focus:ring-[var(--color-navy)] focus:outline-none"
						disabled={isTesting || isSaving}
					/>
					<button
						type="button"
						class="btn btn-secondary"
						onclick={testConnection}
						disabled={!isValidEndpoint || isTesting || isSaving}
					>
						{#if isTesting}
							<svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle
									class="opacity-25"
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
								></circle>
								<path
									class="opacity-75"
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
								></path>
							</svg>
							Testing...
						{:else}
							Test Connection
						{/if}
					</button>
				</div>
				{#if !isValidEndpoint && endpointInput.length > 0}
					<p class="mt-1 text-xs text-[var(--color-error)]">
						Endpoint must start with ws:// or wss://
					</p>
				{/if}
			</div>

			<!-- Test Result -->
			{#if testResult}
				<div
					class="rounded-md p-3 text-sm {testResult.success
						? 'bg-[var(--color-success-muted)] text-[#166534]'
						: 'bg-[var(--color-error-muted)] text-[#991b1b]'}"
				>
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							{#if testResult.success}
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{:else}
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							{/if}
							{testResult.message}
						</div>
						<button
							type="button"
							onclick={dismissBanner}
							class="ml-4 opacity-60 transition-opacity hover:opacity-100"
							aria-label="Dismiss"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M6 18L18 6M6 6l12 12"
								/>
							</svg>
						</button>
					</div>
				</div>
			{/if}

			<!-- Action Buttons -->
			<div class="flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
				<button
					type="button"
					class="btn btn-primary"
					onclick={saveEndpoint}
					disabled={!isValidEndpoint || !hasUnsavedChanges || isTesting || isSaving}
				>
					{#if isSaving}
						<svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							></path>
						</svg>
						Saving...
					{:else}
						<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
							/>
						</svg>
						Save & Connect
					{/if}
				</button>
				<button
					type="button"
					class="btn btn-secondary"
					onclick={resetToDefault}
					disabled={endpointInput === DEFAULT_ENDPOINT || isTesting || isSaving}
				>
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					Reset to Default
				</button>
				{#if hasUnsavedChanges}
					<span class="text-xs text-[var(--color-warning)]">You have unsaved changes</span>
				{/if}
			</div>
		</div>
	</div>

	<!-- Help Section -->
	<div class="card">
		<details class="group">
			<summary class="cursor-pointer list-none">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-medium text-[var(--color-navy)]">Connection Help</h2>
					<svg
						class="h-5 w-5 text-[var(--color-navy)] transition-transform duration-200 group-open:rotate-180"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 9l-7 7-7-7"
						/>
					</svg>
				</div>
				<div class="mt-4 text-sm text-[var(--color-slate)]">
					<h3 class="font-medium text-[var(--color-navy)]">Secure Connections</h3>
					<p class="mt-1">
						For production nodes, use <code class="font-mono">wss://</code> for secure WebSocket connections.
					</p>
				</div>
			</summary>
			<div class="mt-4 text-sm text-[var(--color-slate)]">
				<h3 class="font-medium text-[var(--color-navy)]">Local Development</h3>
				<p class="mt-1">For local development, start a two-node network:</p>
				<div class="mt-2 space-y-3">
					<div>
						<p class="mb-1 text-xs text-[var(--color-slate-light)]">
							Terminal 1 - Start Alice (bootnode)
						</p>
						<pre
							class="overflow-x-auto rounded bg-[var(--color-cream)] px-3 py-2 font-mono text-xs">./target/release/clad-node \
  --chain local \
  --alice \
  --validator \
  --tmp \
  --port 30333 \
  --rpc-port 9944 \
  --node-key 0000000000000000000000000000000000000000000000000000000000000001</pre>
					</div>
					<div>
						<p class="mb-1 text-xs text-[var(--color-slate-light)]">
							Terminal 2 - Start Bob (connects to Alice)
						</p>
						<pre
							class="overflow-x-auto rounded bg-[var(--color-cream)] px-3 py-2 font-mono text-xs">./target/release/clad-node \
  --chain local \
  --bob \
  --validator \
  --tmp \
  --port 30334 \
  --rpc-port 9945 \
  --node-key 0000000000000000000000000000000000000000000000000000000000000002 \
  --bootnodes /ip4/127.0.0.1/tcp/30333/p2p/12D3KooWEyoppNCUx8Yx66oV9fJnriXwCcXwDDUA2kj6vnc6iDEp</pre>
					</div>
				</div>
				<p class="mt-2">
					Default endpoint: <code class="font-mono">ws://127.0.0.1:9944</code>
				</p>
			</div>
		</details>
	</div>
</div>
