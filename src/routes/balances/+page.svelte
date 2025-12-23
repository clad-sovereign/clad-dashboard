<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { subscribeToConnectionState, getApiOrNull, type ConnectionState } from '$lib/substrate';
	import { TOKEN_CONFIG, formatBalance } from '$lib/substrate/types';
	import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';

	// Connection state
	let connectionState: ConnectionState = $state('disconnected');
	let unsubscribeState: (() => void) | null = null;

	// Form state
	let addressInput = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let copied = $state(false);

	// Track if we've processed the URL parameter
	let urlParamProcessed = $state(false);

	// Result state
	let result = $state<{
		address: string;
		cladBalance: bigint;
		nativeBalance: bigint;
		isFrozen: boolean;
		isWhitelisted: boolean;
	} | null>(null);

	onMount(() => {
		unsubscribeState = subscribeToConnectionState((state) => {
			connectionState = state;

			// When connected, check if we have an address in the URL to auto-lookup
			if (state === 'connected' && !urlParamProcessed) {
				const addressParam = $page.url.searchParams.get('address');
				if (addressParam) {
					addressInput = addressParam;
					urlParamProcessed = true;
					lookupBalance();
				}
			}
		});

		// Also check immediately if already connected
		const addressParam = $page.url.searchParams.get('address');
		if (addressParam) {
			addressInput = addressParam;
			if (connectionState === 'connected') {
				urlParamProcessed = true;
				lookupBalance();
			}
		}
	});

	onDestroy(() => {
		if (unsubscribeState) unsubscribeState();
	});

	/**
	 * Validate SS58 address format
	 */
	function validateAddress(address: string): {
		valid: boolean;
		normalized?: string;
		error?: string;
	} {
		if (!address.trim()) {
			return { valid: false, error: 'Please enter an address' };
		}

		try {
			// Decode the address (validates SS58 checksum)
			const decoded = decodeAddress(address);
			// Re-encode to normalize the address format
			const normalized = encodeAddress(decoded);
			return { valid: true, normalized };
		} catch {
			return { valid: false, error: 'Invalid SS58 address format' };
		}
	}

	/**
	 * Look up balance for the given address
	 */
	async function lookupBalance() {
		const api = getApiOrNull();
		if (!api) {
			error = 'Not connected to node. Please wait for connection.';
			return;
		}

		const validation = validateAddress(addressInput);
		if (!validation.valid) {
			error = validation.error ?? 'Invalid address';
			return;
		}

		const address = validation.normalized!;
		isLoading = true;
		error = null;
		result = null;

		try {
			// Query all data in parallel
			const [cladBalanceResult, accountResult, frozenResult, whitelistResult] = await Promise.all([
				api.query.cladToken?.balances?.(address),
				api.query.system.account(address),
				api.query.cladToken?.frozen?.(address),
				api.query.cladToken?.whitelist?.(address)
			]);

			// Extract CLAD balance
			const cladBalance = cladBalanceResult ? BigInt(cladBalanceResult.toString()) : BigInt(0);

			// Extract native balance from system.account
			const accountInfo = accountResult as unknown as { data: { free: { toString(): string } } };
			const nativeBalance = BigInt(accountInfo.data.free.toString());

			// Extract frozen status (boolean storage value)
			const isFrozen = frozenResult ? frozenResult.toString() === 'true' : false;

			// Extract whitelist status (boolean storage value)
			const isWhitelisted = whitelistResult ? whitelistResult.toString() === 'true' : false;

			result = {
				address,
				cladBalance,
				nativeBalance,
				isFrozen,
				isWhitelisted
			};
		} catch (e) {
			console.error('Failed to lookup balance:', e);
			error = e instanceof Error ? e.message : 'Failed to lookup balance';
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Handle form submission
	 */
	function handleSubmit(e: Event) {
		e.preventDefault();
		lookupBalance();
	}

	/**
	 * Copy address to clipboard
	 */
	async function copyAddress() {
		if (!result) return;
		try {
			await navigator.clipboard.writeText(result.address);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 2000);
		} catch (e) {
			console.error('Failed to copy:', e);
		}
	}

	/**
	 * Clear the form and results
	 */
	function clearForm() {
		addressInput = '';
		result = null;
		error = null;
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="font-serif text-2xl text-[var(--color-navy)]">Balance Lookup</h1>
		<p class="mt-1 text-sm text-[var(--color-text-muted)]">
			Check CLAD token and native balances for any account
		</p>
	</div>

	<!-- Search Form -->
	<div class="card">
		<form onsubmit={handleSubmit} class="space-y-4">
			<div>
				<label for="address" class="block text-sm font-medium text-[var(--color-slate)]">
					Account Address
				</label>
				<div class="mt-1 flex gap-2">
					<input
						type="text"
						id="address"
						bind:value={addressInput}
						placeholder="Enter SS58 address (e.g., 5GrwvaEF...)"
						class="flex-1 rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-sm placeholder:text-[var(--color-slate-light)] focus:border-[var(--color-navy)] focus:ring-1 focus:ring-[var(--color-navy)] focus:outline-none"
						disabled={connectionState !== 'connected' || isLoading}
					/>
					<button
						type="submit"
						class="btn btn-primary"
						disabled={connectionState !== 'connected' || isLoading || !addressInput.trim()}
					>
						{#if isLoading}
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
							Looking up...
						{:else}
							<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
								/>
							</svg>
							Lookup
						{/if}
					</button>
					{#if result || error}
						<button type="button" class="btn btn-secondary" onclick={clearForm}> Clear </button>
					{/if}
				</div>
			</div>
		</form>

		{#if connectionState !== 'connected'}
			<div class="mt-4 rounded-md bg-[var(--color-warning-muted)] p-3 text-sm text-[#92400e]">
				<div class="flex items-center gap-2">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						/>
					</svg>
					{connectionState === 'connecting' ? 'Connecting to node...' : 'Not connected to node'}
				</div>
			</div>
		{/if}

		{#if error}
			<div class="mt-4 rounded-md bg-[var(--color-error-muted)] p-3 text-sm text-[#991b1b]">
				<div class="flex items-center gap-2">
					<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					{error}
				</div>
			</div>
		{/if}
	</div>

	<!-- Results -->
	{#if result}
		<div class="card">
			<div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
				<h2 class="text-lg font-semibold text-[var(--color-navy)]">Account Details</h2>
				<div class="flex flex-wrap gap-2">
					{#if result.isWhitelisted}
						<span class="badge badge-success">Whitelisted</span>
					{:else}
						<span class="badge badge-error">Not Whitelisted</span>
					{/if}
					{#if result.isFrozen}
						<span class="badge badge-error">Frozen</span>
					{/if}
				</div>
			</div>

			<!-- Address -->
			<div class="mt-4">
				<span class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase">
					Address
				</span>
				<div class="mt-1 flex items-center gap-2">
					<code
						class="flex-1 rounded bg-[var(--color-cream)] px-3 py-2 font-mono text-sm break-all text-[var(--color-navy)]"
					>
						{result.address}
					</code>
					<button
						type="button"
						class="btn btn-secondary"
						onclick={copyAddress}
						title="Copy address to clipboard"
					>
						{#if copied}
							<svg
								class="h-4 w-4 text-[var(--color-success)]"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
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
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								/>
							</svg>
						{/if}
					</button>
				</div>
			</div>

			<!-- Balances Grid -->
			<div class="mt-6 grid gap-4 md:grid-cols-2">
				<!-- CLAD Balance -->
				<div class="rounded-lg border border-[var(--color-border)] p-4">
					<div class="flex items-center gap-2">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-navy)] text-white"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
						</div>
						<div>
							<p
								class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
							>
								CLAD Balance
							</p>
							<p class="text-xl font-semibold text-[var(--color-navy)]">
								{formatBalance(result.cladBalance, TOKEN_CONFIG.CLAD_DECIMALS)}
							</p>
						</div>
					</div>
				</div>

				<!-- Native Balance -->
				<div class="rounded-lg border border-[var(--color-border)] p-4">
					<div class="flex items-center gap-2">
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-teal)] text-white"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 10V3L4 14h7v7l9-11h-7z"
								/>
							</svg>
						</div>
						<div>
							<p
								class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
							>
								Native Balance (Fees)
							</p>
							<p class="text-xl font-semibold text-[var(--color-navy)]">
								{formatBalance(result.nativeBalance, TOKEN_CONFIG.NATIVE_DECIMALS)}
							</p>
						</div>
					</div>
				</div>
			</div>

			<!-- Status Details -->
			{#if result.isFrozen || !result.isWhitelisted}
				<div class="mt-6 space-y-3">
					{#if result.isFrozen}
						<div class="rounded-md bg-[var(--color-error-muted)] p-3 text-sm">
							<div class="flex items-start gap-2">
								<svg
									class="mt-0.5 h-4 w-4 text-[var(--color-error)]"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
								<div>
									<p class="font-medium text-[#991b1b]">Account Frozen</p>
									<p class="mt-0.5 text-[#991b1b]/80">
										This account cannot send tokens. It can still receive tokens.
									</p>
								</div>
							</div>
						</div>
					{/if}
					{#if !result.isWhitelisted}
						<div class="rounded-md bg-[var(--color-warning-muted)] p-3 text-sm">
							<div class="flex items-start gap-2">
								<svg
									class="mt-0.5 h-4 w-4 text-[var(--color-warning)]"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
								<div>
									<p class="font-medium text-[#92400e]">Not Whitelisted</p>
									<p class="mt-0.5 text-[#92400e]/80">
										This account has not completed KYC and cannot participate in token transfers.
									</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>
