<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { subscribeToConnectionState, getApiOrNull, type ConnectionState } from '$lib/substrate';
	import { formatAddress } from '$lib/substrate/types';
	import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
	import { CsvUpload, CsvPreviewTable, BatchProgress } from '$lib/components';
	import { getServerConnectionState } from '$lib/api';
	import { createBatchWhitelistProposals, type BatchResult } from '$lib/services';
	import type { CsvParseResult } from '$lib/utils';

	// Connection state
	let connectionState: ConnectionState = $state('disconnected');
	let unsubscribeState: (() => void) | null = null;

	// Form state (single address lookup)
	let addressInput = $state('');
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// Results state (supports batch lookup)
	let results = $state<
		Array<{
			address: string;
			isWhitelisted: boolean;
			error?: string;
		}>
	>([]);

	// Batch upload state
	let csvResult = $state<CsvParseResult | null>(null);
	let csvFileName = $state<string>('');
	let isCreatingProposals = $state(false);
	let batchProgress = $state<{ current: number; total: number; currentAddress: string }>({
		current: 0,
		total: 0,
		currentAddress: ''
	});
	let batchResult = $state<BatchResult | null>(null);

	// Existing whitelist (for duplicate detection)
	let existingWhitelist = new SvelteSet<string>();

	// View mode
	let viewMode = $state<'lookup' | 'batch'>('lookup');

	onMount(() => {
		unsubscribeState = subscribeToConnectionState(async (state) => {
			connectionState = state;
		});
	});

	onDestroy(() => {
		if (unsubscribeState) unsubscribeState();
	});

	/**
	 * Validate and normalize SS58 address
	 */
	function validateAddress(address: string): {
		valid: boolean;
		normalized?: string;
		error?: string;
	} {
		const trimmed = address.trim();
		if (!trimmed) {
			return { valid: false, error: 'Empty address' };
		}

		try {
			const decoded = decodeAddress(trimmed);
			const normalized = encodeAddress(decoded);
			return { valid: true, normalized };
		} catch {
			return { valid: false, error: 'Invalid SS58 address format' };
		}
	}

	/**
	 * Parse input for multiple addresses (comma, newline, or space separated)
	 */
	function parseAddresses(input: string): string[] {
		return input
			.split(/[,\n\s]+/)
			.map((addr) => addr.trim())
			.filter((addr) => addr.length > 0);
	}

	/**
	 * Look up whitelist status for addresses
	 */
	async function lookupWhitelist() {
		const api = getApiOrNull();
		if (!api) {
			error = 'Not connected to node. Please wait for connection.';
			return;
		}

		const rawAddresses = parseAddresses(addressInput);
		if (rawAddresses.length === 0) {
			error = 'Please enter at least one address';
			return;
		}

		isLoading = true;
		error = null;
		results = [];

		const newResults: typeof results = [];
		const whitelistedAddrs: string[] = [];

		for (const rawAddr of rawAddresses) {
			const validation = validateAddress(rawAddr);

			if (!validation.valid) {
				newResults.push({
					address: rawAddr,
					isWhitelisted: false,
					error: validation.error
				});
				continue;
			}

			const address = validation.normalized!;

			try {
				const whitelistResult = await api.query.cladToken?.whitelist?.(address);
				const isWhitelisted = whitelistResult ? whitelistResult.toString() === 'true' : false;

				newResults.push({
					address,
					isWhitelisted
				});

				if (isWhitelisted) {
					whitelistedAddrs.push(address);
				}
			} catch (e) {
				console.error('Failed to lookup whitelist status:', e);
				newResults.push({
					address,
					isWhitelisted: false,
					error: e instanceof Error ? e.message : 'Lookup failed'
				});
			}
		}

		results = newResults;
		// Update existing whitelist with newly fetched addresses
		existingWhitelist.clear();
		for (const addr of whitelistedAddrs) {
			existingWhitelist.add(addr);
		}
		isLoading = false;
	}

	/**
	 * Handle form submission
	 */
	function handleSubmit(e: Event) {
		e.preventDefault();
		lookupWhitelist();
	}

	/**
	 * Clear the form and results
	 */
	function clearForm() {
		addressInput = '';
		results = [];
		error = null;
	}

	/**
	 * Export results to CSV
	 */
	function exportCSV() {
		if (results.length === 0) return;

		const headers = ['Address', 'Status', 'Error'];
		const rows = results.map((r) => [
			r.address,
			r.error ? 'Error' : r.isWhitelisted ? 'Approved' : 'Not Approved',
			r.error || ''
		]);

		const csvContent = [headers, ...rows]
			.map((row) => row.map((cell) => `"${cell}"`).join(','))
			.join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const filename = `whitelist-check-${new Date().toISOString().split('T')[0]}.csv`;

		// Create and inject a temporary link
		const link = document.createElement('a');
		link.style.cssText = 'position:fixed;left:-9999px';
		link.href = url;
		link.download = filename;
		link.setAttribute('data-sveltekit-reload', '');
		document.body.appendChild(link);

		// Use setTimeout to ensure DOM is updated before clicking
		setTimeout(() => {
			link.click();
			setTimeout(() => {
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
			}, 100);
		}, 0);
	}

	/**
	 * Handle CSV parse result
	 */
	function handleCsvParsed(result: CsvParseResult, fileName: string) {
		csvResult = result;
		csvFileName = fileName;
		batchResult = null;
	}

	/**
	 * Clear CSV preview
	 */
	function clearCsvPreview() {
		csvResult = null;
		csvFileName = '';
		batchResult = null;
	}

	/**
	 * Create proposals for valid addresses
	 */
	async function handleCreateProposals(addresses: string[]) {
		const api = getApiOrNull();
		if (!api) {
			error = 'Not connected to node. Please wait for connection.';
			return;
		}

		// Check server connection
		const serverState = getServerConnectionState();
		if (serverState.state !== 'connected') {
			error = 'Not connected to CLAD Server. Please check Settings.';
			return;
		}

		isCreatingProposals = true;
		batchProgress = { current: 0, total: addresses.length, currentAddress: '' };
		error = null;

		try {
			// Use a placeholder address for createdBy (in production, this would come from the connected wallet)
			const createdBy = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';

			const result = await createBatchWhitelistProposals(
				api,
				addresses,
				createdBy,
				(current, total, address) => {
					batchProgress = { current, total, currentAddress: address };
				}
			);

			batchResult = result;
		} catch (e) {
			console.error('Failed to create proposals:', e);
			error = e instanceof Error ? e.message : 'Failed to create proposals';
		} finally {
			isCreatingProposals = false;
		}
	}

	/**
	 * Dismiss batch result and go back to upload
	 */
	function dismissBatchResult() {
		batchResult = null;
		csvResult = null;
		csvFileName = '';
	}

	// Derived counts
	let approvedCount = $derived(results.filter((r) => r.isWhitelisted && !r.error).length);
	let notApprovedCount = $derived(results.filter((r) => !r.isWhitelisted && !r.error).length);
	let errorCount = $derived(results.filter((r) => r.error).length);
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="font-serif text-2xl text-[var(--color-navy)]">KYC Whitelist</h1>
		<p class="mt-1 text-sm text-[var(--color-text-muted)]">
			Verify whitelist status or batch upload addresses for proposals
		</p>
	</div>

	<!-- View Mode Tabs -->
	<div class="flex border-b border-[var(--color-border)]">
		<button
			type="button"
			class="px-4 py-2 text-sm font-medium transition-colors {viewMode === 'lookup'
				? 'border-b-2 border-[var(--color-navy)] text-[var(--color-navy)]'
				: 'text-[var(--color-slate)] hover:text-[var(--color-navy)]'}"
			onclick={() => (viewMode = 'lookup')}
		>
			<svg class="mr-2 inline-block h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
				/>
			</svg>
			Status Lookup
		</button>
		<button
			type="button"
			class="px-4 py-2 text-sm font-medium transition-colors {viewMode === 'batch'
				? 'border-b-2 border-[var(--color-navy)] text-[var(--color-navy)]'
				: 'text-[var(--color-slate)] hover:text-[var(--color-navy)]'}"
			onclick={() => (viewMode = 'batch')}
		>
			<svg class="mr-2 inline-block h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
				/>
			</svg>
			Batch Upload
		</button>
	</div>

	{#if viewMode === 'lookup'}
		<!-- Single/Multi Address Lookup -->
		<div class="card">
			<form onsubmit={handleSubmit} class="space-y-4">
				<div>
					<label for="addresses" class="block text-sm font-medium text-[var(--color-slate)]">
						Account Address(es)
					</label>
					<p class="mt-0.5 text-xs text-[var(--color-slate-light)]">
						Enter one or more addresses (comma, space, or newline separated)
					</p>
					<div class="mt-2">
						<textarea
							id="addresses"
							bind:value={addressInput}
							placeholder="Enter SS58 addresses...&#10;5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY&#10;5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"
							rows="4"
							class="w-full rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-sm placeholder:text-[var(--color-slate-light)] focus:border-[var(--color-navy)] focus:ring-1 focus:ring-[var(--color-navy)] focus:outline-none"
							disabled={connectionState !== 'connected' || isLoading}
						></textarea>
					</div>
					<div class="mt-3 flex gap-2">
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
								Checking...
							{:else}
								<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
									/>
								</svg>
								Check Status
							{/if}
						</button>
						{#if results.length > 0 || error}
							<button type="button" class="btn btn-secondary" onclick={clearForm}>Clear</button>
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

		<!-- Lookup Results -->
		{#if results.length > 0}
			<!-- Summary Bar -->
			<div class="card">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-6">
						<div class="text-sm">
							<span class="text-[var(--color-slate-light)]">Total:</span>
							<span class="ml-1 font-semibold text-[var(--color-navy)]">{results.length}</span>
						</div>
						<div class="text-sm">
							<span class="text-[var(--color-slate-light)]">Approved:</span>
							<span class="ml-1 font-semibold text-[var(--color-success)]">{approvedCount}</span>
						</div>
						<div class="text-sm">
							<span class="text-[var(--color-slate-light)]">Not Approved:</span>
							<span class="ml-1 font-semibold text-[var(--color-error)]">{notApprovedCount}</span>
						</div>
						{#if errorCount > 0}
							<div class="text-sm">
								<span class="text-[var(--color-slate-light)]">Errors:</span>
								<span class="ml-1 font-semibold text-[var(--color-warning)]">{errorCount}</span>
							</div>
						{/if}
					</div>
					<button type="button" class="btn btn-secondary text-sm" onclick={exportCSV}>
						<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							/>
						</svg>
						Export CSV
					</button>
				</div>
			</div>

			<!-- Results List -->
			{#if results.length === 1}
				<!-- Single result - large display -->
				{@const result = results[0]}
				<div class="card">
					{#if result.error}
						<!-- Error state -->
						<div class="flex flex-col items-center py-8">
							<div
								class="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-warning-muted)]"
							>
								<svg
									class="h-10 w-10 text-[var(--color-warning)]"
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
							</div>
							<h2 class="mt-4 text-xl font-semibold text-[var(--color-warning)]">Lookup Error</h2>
							<p class="mt-2 text-sm text-[var(--color-slate)]">{result.error}</p>
							<code
								class="mt-4 rounded bg-[var(--color-cream)] px-3 py-2 font-mono text-sm break-all text-[var(--color-navy)]"
							>
								{result.address}
							</code>
						</div>
					{:else if result.isWhitelisted}
						<!-- Approved state -->
						<div class="flex flex-col items-center py-8">
							<div
								class="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-success-muted)]"
							>
								<svg
									class="h-10 w-10 text-[var(--color-success)]"
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
							</div>
							<h2 class="mt-4 text-xl font-semibold text-[var(--color-success)]">KYC Approved</h2>
							<p class="mt-2 text-sm text-[var(--color-slate)]">
								This account is approved for CLAD token transfers
							</p>
							<code
								class="mt-4 rounded bg-[var(--color-cream)] px-3 py-2 font-mono text-sm break-all text-[var(--color-navy)]"
							>
								{result.address}
							</code>
						</div>
					{:else}
						<!-- Not approved state -->
						<div class="flex flex-col items-center py-8">
							<div
								class="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--color-error-muted)]"
							>
								<svg
									class="h-10 w-10 text-[var(--color-error)]"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							</div>
							<h2 class="mt-4 text-xl font-semibold text-[var(--color-error)]">Not Approved</h2>
							<p class="mt-2 text-sm text-[var(--color-slate)]">
								This account has not completed KYC verification
							</p>
							<code
								class="mt-4 rounded bg-[var(--color-cream)] px-3 py-2 font-mono text-sm break-all text-[var(--color-navy)]"
							>
								{result.address}
							</code>
						</div>
					{/if}
				</div>
			{:else}
				<!-- Multiple results - table display -->
				<div class="card overflow-x-auto p-0">
					<table class="w-full min-w-[400px]">
						<thead>
							<tr class="border-b border-[var(--color-border)] bg-[var(--color-cream)]">
								<th
									class="px-4 py-3 text-left text-xs font-medium tracking-wide text-[var(--color-slate)] uppercase"
								>
									Address
								</th>
								<th
									class="px-4 py-3 text-left text-xs font-medium tracking-wide text-[var(--color-slate)] uppercase"
								>
									Status
								</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-[var(--color-border)]">
							{#each results as result (result.address)}
								<tr class="hover:bg-[var(--color-cream)]/50">
									<td class="px-4 py-3">
										<div class="flex flex-col">
											<code class="font-mono text-sm text-[var(--color-navy)]">
												{formatAddress(result.address, 8)}
											</code>
											<span class="mt-0.5 font-mono text-xs text-[var(--color-slate-light)]">
												{result.address}
											</span>
										</div>
									</td>
									<td class="px-4 py-3">
										{#if result.error}
											<span class="badge badge-warning">Error: {result.error}</span>
										{:else if result.isWhitelisted}
											<span class="badge badge-success">
												<svg
													class="mr-1 h-3 w-3"
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
												Approved
											</span>
										{:else}
											<span class="badge badge-error">
												<svg
													class="mr-1 h-3 w-3"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
												>
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
												Not Approved
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	{:else}
		<!-- Batch Upload View -->
		{#if connectionState !== 'connected'}
			<div class="rounded-md bg-[var(--color-warning-muted)] p-4 text-sm text-[#92400e]">
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
		{:else if isCreatingProposals}
			<!-- Progress display -->
			<BatchProgress
				current={batchProgress.current}
				total={batchProgress.total}
				currentAddress={batchProgress.currentAddress}
			/>
		{:else if batchResult}
			<!-- Result display -->
			<BatchProgress
				current={batchProgress.total}
				total={batchProgress.total}
				result={batchResult}
				onDismiss={dismissBatchResult}
			/>

			{#if batchResult.successCount > 0}
				<div class="flex justify-center">
					<a href="/proposals" class="btn btn-primary">
						<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
							/>
						</svg>
						View Proposals
					</a>
				</div>
			{/if}
		{:else if csvResult}
			<!-- CSV Preview -->
			<CsvPreviewTable
				result={csvResult}
				fileName={csvFileName}
				onClear={clearCsvPreview}
				onProceed={handleCreateProposals}
			/>
		{:else}
			<!-- Upload area -->
			<div class="card">
				<h3 class="mb-4 font-medium text-[var(--color-navy)]">Upload Addresses</h3>
				<CsvUpload onParsed={handleCsvParsed} {existingWhitelist} />

				<div class="mt-4 rounded-md bg-[var(--color-cream)] p-4">
					<h4 class="text-sm font-medium text-[var(--color-navy)]">CSV Format</h4>
					<p class="mt-1 text-xs text-[var(--color-slate-light)]">
						Upload a CSV file with one SS58 address per line. Optional header row is supported.
					</p>
					<pre class="mt-2 rounded bg-white p-3 font-mono text-xs text-[var(--color-slate)]">address
5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y</pre>
				</div>
			</div>

			<!-- Info box -->
			<div class="card">
				<div class="flex items-start gap-3">
					<svg
						class="h-5 w-5 flex-shrink-0 text-[var(--color-teal)]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<div>
						<h4 class="font-medium text-[var(--color-navy)]">How Batch Upload Works</h4>
						<ol class="mt-2 list-inside list-decimal space-y-1 text-sm text-[var(--color-slate)]">
							<li>Upload a CSV file with addresses to whitelist</li>
							<li>Review and validate addresses (duplicates and errors are flagged)</li>
							<li>Click "Create Proposals" to submit to CLAD Server</li>
							<li>Proposals appear in the Proposals page for mobile approval</li>
							<li>Signatories use CLAD Mobile to approve and submit to the chain</li>
						</ol>
						<p class="mt-3 text-xs text-[var(--color-slate-light)]">
							Note: Dashboard cannot sign transactions. All approvals must be done via CLAD Mobile.
						</p>
					</div>
				</div>
			</div>
		{/if}

		{#if error}
			<div class="rounded-md bg-[var(--color-error-muted)] p-4 text-sm text-[#991b1b]">
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
	{/if}
</div>
