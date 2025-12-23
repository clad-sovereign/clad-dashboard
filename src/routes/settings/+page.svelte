<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		subscribeToConnectionState,
		connect,
		disconnect,
		testConnection as testEndpointConnection,
		type ConnectionState
	} from '$lib/substrate';
	import {
		subscribeToServerState,
		getServerUrl,
		setServerUrl,
		getDefaultServerUrl,
		testServerConnection,
		checkHealth,
		isMockMode,
		type ServerConnectionState
	} from '$lib/api';
	import { StatusDot } from '$lib/components';

	const DEFAULT_ENDPOINT = 'ws://127.0.0.1:9944';
	const STORAGE_KEY = 'clad-dashboard-endpoint';
	const BANNER_TIMEOUT_MS = 5000;

	// Node connection state
	let connectionState: ConnectionState = $state('disconnected');
	let connectionError: string | null = $state(null);
	let unsubscribeState: (() => void) | null = null;
	let bannerTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Server connection state
	let serverState: ServerConnectionState = $state('disconnected');
	let serverError: string | null = $state(null);
	let unsubscribeServerState: (() => void) | null = null;
	let serverBannerTimeoutId: ReturnType<typeof setTimeout> | null = null;

	// Node form state
	let endpointInput = $state(DEFAULT_ENDPOINT);
	let savedEndpoint = $state(DEFAULT_ENDPOINT);
	let isTesting = $state(false);
	let isSaving = $state(false);
	let testResult = $state<{ success: boolean; message: string } | null>(null);

	// Server form state
	let serverUrlInput = $state(getDefaultServerUrl());
	let savedServerUrl = $state(getDefaultServerUrl());
	let isTestingServer = $state(false);
	let isSavingServer = $state(false);
	let serverTestResult = $state<{ success: boolean; message: string } | null>(null);

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

	// Derived states - Node
	let hasUnsavedChanges = $derived(endpointInput !== savedEndpoint);
	let isValidEndpoint = $derived(
		endpointInput.startsWith('ws://') || endpointInput.startsWith('wss://')
	);

	// Derived states - Server
	let hasServerUnsavedChanges = $derived(serverUrlInput !== savedServerUrl);
	let isValidServerUrl = $derived(
		serverUrlInput.startsWith('http://') || serverUrlInput.startsWith('https://')
	);

	onMount(() => {
		// Load saved endpoint from localStorage
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored) {
			endpointInput = stored;
			savedEndpoint = stored;
		}

		// Load saved server URL
		serverUrlInput = getServerUrl();
		savedServerUrl = getServerUrl();

		// Subscribe to node connection state
		unsubscribeState = subscribeToConnectionState((state, error) => {
			connectionState = state;
			connectionError = error ?? null;
		});

		// Subscribe to server connection state
		unsubscribeServerState = subscribeToServerState((state, error) => {
			serverState = state;
			serverError = error ?? null;
		});
	});

	onDestroy(() => {
		if (unsubscribeState) unsubscribeState();
		if (unsubscribeServerState) unsubscribeServerState();
		if (bannerTimeoutId) clearTimeout(bannerTimeoutId);
		if (serverBannerTimeoutId) clearTimeout(serverBannerTimeoutId);
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
	function getStatusDisplay(state: ConnectionState | ServerConnectionState): {
		label: string;
		class: string;
	} {
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
	let serverStatusDisplay = $derived(getStatusDisplay(serverState));

	// ============================================================================
	// Server Functions
	// ============================================================================

	/**
	 * Set server test result with auto-dismiss for success messages
	 */
	function setServerTestResult(result: { success: boolean; message: string }) {
		if (serverBannerTimeoutId) {
			clearTimeout(serverBannerTimeoutId);
			serverBannerTimeoutId = null;
		}

		serverTestResult = result;

		if (result.success) {
			serverBannerTimeoutId = setTimeout(() => {
				serverTestResult = null;
				serverBannerTimeoutId = null;
			}, BANNER_TIMEOUT_MS);
		}
	}

	/**
	 * Dismiss server banner manually
	 */
	function dismissServerBanner() {
		if (serverBannerTimeoutId) {
			clearTimeout(serverBannerTimeoutId);
			serverBannerTimeoutId = null;
		}
		serverTestResult = null;
	}

	/**
	 * Test connection to the CLAD Server (without affecting stored state)
	 */
	async function testServer() {
		if (!isValidServerUrl) {
			setServerTestResult({
				success: false,
				message: 'Invalid URL. Must start with http:// or https://'
			});
			return;
		}

		isTestingServer = true;
		serverTestResult = null;

		const result = await testServerConnection(serverUrlInput, 10000);

		if (result.success) {
			setServerTestResult({ success: true, message: 'Connection successful!' });
		} else {
			setServerTestResult({
				success: false,
				message: result.error || 'Connection failed'
			});
		}

		isTestingServer = false;
	}

	/**
	 * Save the server URL and check health
	 */
	async function saveServerUrl() {
		if (!isValidServerUrl) return;

		isSavingServer = true;
		serverTestResult = null;

		try {
			setServerUrl(serverUrlInput);
			savedServerUrl = serverUrlInput;

			const result = await checkHealth();

			if (result.success) {
				setServerTestResult({ success: true, message: 'Settings saved and connected!' });
			} else {
				setServerTestResult({
					success: false,
					message: result.error?.message || 'Failed to connect after saving'
				});
			}
		} catch (error) {
			setServerTestResult({
				success: false,
				message: error instanceof Error ? error.message : 'Failed to connect after saving'
			});
		} finally {
			isSavingServer = false;
		}
	}

	/**
	 * Reset to default server URL
	 */
	async function resetServerToDefault() {
		const defaultUrl = getDefaultServerUrl();
		serverUrlInput = defaultUrl;
		serverTestResult = null;

		isSavingServer = true;
		try {
			setServerUrl(defaultUrl);
			savedServerUrl = defaultUrl;

			const result = await checkHealth();

			if (result.success) {
				setServerTestResult({ success: true, message: 'Reset to default and connected!' });
			} else {
				setServerTestResult({
					success: false,
					message: result.error?.message || 'Failed to connect to default server'
				});
			}
		} catch (error) {
			setServerTestResult({
				success: false,
				message: error instanceof Error ? error.message : 'Failed to connect to default server'
			});
		} finally {
			isSavingServer = false;
		}
	}
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

	<!-- CLAD Server Configuration -->
	<div class="card">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-medium text-[var(--color-navy)]">CLAD Server</h2>
				<p class="mt-1 text-sm text-[var(--color-slate-light)]">
					Configure the backend server for batch operations and account metadata
				</p>
			</div>
			{#if isMockMode()}
				<span class="badge badge-warning">Mock Mode</span>
			{/if}
		</div>

		{#if isMockMode()}
			<div class="mt-4 rounded-md bg-[var(--color-warning-muted)] p-3 text-sm text-[#92400e]">
				<div class="flex items-center gap-2">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					Mock mode is enabled. API calls return simulated data.
				</div>
			</div>
		{:else}
			<!-- Server Status -->
			<div class="mt-4 flex items-center gap-4">
				<div class="flex items-center gap-2">
					<StatusDot status={serverState} />
					<span class="badge {serverStatusDisplay.class}">{serverStatusDisplay.label}</span>
				</div>
				{#if serverError}
					<span class="text-sm text-[var(--color-error)]">{serverError}</span>
				{/if}
			</div>
			{#if serverState === 'connected'}
				<p class="mt-2 text-sm text-[var(--color-slate-light)]">
					Connected to: <code class="font-mono text-[var(--color-navy)]">{savedServerUrl}</code>
				</p>
			{/if}

			<div class="mt-4 space-y-4">
				<!-- Server URL Input -->
				<div>
					<label for="server-url" class="block text-sm font-medium text-[var(--color-slate)]">
						Server URL
					</label>
					<div class="mt-2 flex gap-2">
						<input
							type="text"
							id="server-url"
							bind:value={serverUrlInput}
							placeholder="http://localhost:8080"
							class="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-sm placeholder:text-[var(--color-slate-light)] focus:border-[var(--color-navy)] focus:ring-1 focus:ring-[var(--color-navy)] focus:outline-none"
							disabled={isTestingServer || isSavingServer}
						/>
						<button
							type="button"
							class="btn btn-secondary"
							onclick={testServer}
							disabled={!isValidServerUrl || isTestingServer || isSavingServer}
						>
							{#if isTestingServer}
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
					{#if !isValidServerUrl && serverUrlInput.length > 0}
						<p class="mt-1 text-xs text-[var(--color-error)]">
							URL must start with http:// or https://
						</p>
					{/if}
				</div>

				<!-- Server Test Result -->
				{#if serverTestResult}
					<div
						class="rounded-md p-3 text-sm {serverTestResult.success
							? 'bg-[var(--color-success-muted)] text-[#166534]'
							: 'bg-[var(--color-error-muted)] text-[#991b1b]'}"
					>
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2">
								{#if serverTestResult.success}
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
								{serverTestResult.message}
							</div>
							<button
								type="button"
								onclick={dismissServerBanner}
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

				<!-- Server Action Buttons -->
				<div class="flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
					<button
						type="button"
						class="btn btn-primary"
						onclick={saveServerUrl}
						disabled={!isValidServerUrl ||
							!hasServerUnsavedChanges ||
							isTestingServer ||
							isSavingServer}
					>
						{#if isSavingServer}
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
						onclick={resetServerToDefault}
						disabled={serverUrlInput === getDefaultServerUrl() || isTestingServer || isSavingServer}
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
					{#if hasServerUnsavedChanges}
						<span class="text-xs text-[var(--color-warning)]">You have unsaved changes</span>
					{/if}
				</div>
			</div>
		{/if}
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
