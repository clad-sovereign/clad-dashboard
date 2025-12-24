<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { subscribeToConnectionState, getApiOrNull, decodeCall } from '$lib/substrate';
	import { formatAddress } from '$lib/substrate/types';
	import { CardSkeleton } from '$lib/components';
	import { listCallData, subscribeToServerState, type ServerConnectionState } from '$lib/api';
	import type { CallData } from '$lib/api/types';
	import { formatDateTime } from '$lib/utils';

	// Connection state
	let serverConnectionState: ServerConnectionState = $state('disconnected');
	let unsubscribeNodeState: (() => void) | null = null;
	let unsubscribeServerState: (() => void) | null = null;

	// Data state
	let proposals = $state<CallData[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let lastRefresh = $state<Date | null>(null);

	// Filter state
	let filterCallName = $state<string>('all');

	// Polling interval (30 seconds)
	let pollInterval: ReturnType<typeof setInterval> | null = null;
	const POLL_INTERVAL_MS = 30000;

	onMount(() => {
		// Subscribe to node connection for call decoding
		unsubscribeNodeState = subscribeToConnectionState(() => {
			// Node state used for decoding calls - no direct action needed
		});

		unsubscribeServerState = subscribeToServerState((state) => {
			serverConnectionState = state;
			if (state === 'connected') {
				fetchProposals();
				startPolling();
			} else {
				stopPolling();
			}
		});
	});

	onDestroy(() => {
		if (unsubscribeNodeState) unsubscribeNodeState();
		if (unsubscribeServerState) unsubscribeServerState();
		stopPolling();
	});

	function startPolling() {
		stopPolling();
		pollInterval = setInterval(() => {
			if (serverConnectionState === 'connected') {
				fetchProposals();
			}
		}, POLL_INTERVAL_MS);
	}

	function stopPolling() {
		if (pollInterval) {
			clearInterval(pollInterval);
			pollInterval = null;
		}
	}

	async function fetchProposals() {
		isLoading = true;
		error = null;

		try {
			const result = await listCallData();

			if (result.success) {
				proposals = result.data;
				lastRefresh = new Date();
			} else {
				error = result.error.message;
			}
		} catch (e) {
			console.error('Failed to fetch proposals:', e);
			error = e instanceof Error ? e.message : 'Failed to fetch proposals';
		} finally {
			isLoading = false;
		}
	}

	async function refresh() {
		await fetchProposals();
	}

	// Get unique call names for filter
	let callNames = $derived.by(() => {
		const names = new Set(proposals.map((p) => p.callName));
		return ['all', ...Array.from(names).sort()];
	});

	// Filter proposals
	let filteredProposals = $derived.by(() => {
		if (filterCallName === 'all') {
			return proposals;
		}
		return proposals.filter((p) => p.callName === filterCallName);
	});

	// Format timestamp
	function formatTimestamp(timestamp: number): string {
		return formatDateTime(timestamp * 1000, 'medium', 'short');
	}

	// Get relative time
	function getRelativeTime(timestamp: number): string {
		const now = Date.now() / 1000;
		const diff = now - timestamp;

		if (diff < 60) return 'just now';
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}

	// Get badge class for call type
	function getCallBadge(callName: string): string {
		switch (callName) {
			case 'addToWhitelist':
				return 'badge-success';
			case 'removeFromWhitelist':
				return 'badge-warning';
			case 'mint':
				return 'badge-success';
			case 'freeze':
				return 'badge-error';
			case 'unfreeze':
				return 'badge-success';
			default:
				return 'badge';
		}
	}

	// Decode call description from encoded call (if API connected)
	function getCallDescription(proposal: CallData): string {
		if (proposal.description) {
			return proposal.description;
		}

		const api = getApiOrNull();
		if (api && proposal.encodedCall) {
			try {
				const decoded = decodeCall(api, proposal.encodedCall);
				if (decoded.success && decoded.description) {
					return decoded.description;
				}
			} catch {
				// Ignore decoding errors
			}
		}

		return `${proposal.palletName}.${proposal.callName}`;
	}

	// Navigate to balances page
	function navigateToBalance(address: string) {
		goto(`/balances?address=${encodeURIComponent(address)}`);
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 class="font-serif text-2xl text-[var(--color-navy)]">Proposals</h1>
			<p class="mt-1 text-sm text-[var(--color-text-muted)]">
				Call data stored on CLAD Server, waiting for multi-sig approval
			</p>
		</div>
		<div class="flex gap-2">
			<a href="/whitelist" class="btn btn-secondary">
				<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 6v6m0 0v6m0-6h6m-6 0H6"
					/>
				</svg>
				New Batch
			</a>
			<button
				type="button"
				class="btn btn-secondary"
				onclick={refresh}
				disabled={isLoading || serverConnectionState !== 'connected'}
			>
				{#if isLoading}
					<svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				{:else}
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
				{/if}
				Refresh
			</button>
		</div>
	</div>

	<!-- Server connection warning -->
	{#if serverConnectionState !== 'connected'}
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
				{serverConnectionState === 'connecting'
					? 'Connecting to CLAD Server...'
					: 'Not connected to CLAD Server. Check Settings to configure the server URL.'}
			</div>
		</div>
	{/if}

	<!-- Error message -->
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

	<!-- Filter -->
	{#if proposals.length > 0}
		<div class="card">
			<div class="flex flex-wrap items-center gap-4">
				<div>
					<label
						for="filter-call"
						class="block text-xs font-medium text-[var(--color-slate-light)]"
					>
						Filter by Type
					</label>
					<select
						id="filter-call"
						bind:value={filterCallName}
						class="mt-1 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-sm focus:border-[var(--color-navy)] focus:ring-1 focus:ring-[var(--color-navy)] focus:outline-none"
					>
						{#each callNames as name (name)}
							<option value={name}>
								{name === 'all' ? 'All Types' : name}
							</option>
						{/each}
					</select>
				</div>
				<div class="flex-1"></div>
				<div class="text-sm text-[var(--color-slate-light)]">
					{filteredProposals.length} of {proposals.length} proposals
				</div>
			</div>
		</div>
	{/if}

	<!-- Loading state -->
	{#if isLoading && proposals.length === 0}
		<CardSkeleton count={3} />
	{/if}

	<!-- Proposals list -->
	{#if !isLoading || proposals.length > 0}
		{#if proposals.length === 0}
			<div class="card">
				<div class="flex flex-col items-center justify-center py-12">
					<svg
						class="h-12 w-12 text-[var(--color-slate-light)]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
					<p class="mt-4 text-[var(--color-slate)]">No proposals found</p>
					<p class="mt-1 text-sm text-[var(--color-slate-light)]">
						Upload a CSV file from the Whitelist page to create batch proposals
					</p>
					<a href="/whitelist" class="btn btn-primary mt-4">
						<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
							/>
						</svg>
						Upload Addresses
					</a>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				{#each filteredProposals as proposal (proposal.callHash)}
					<div class="card">
						<div class="flex items-start justify-between gap-4">
							<div class="flex items-start gap-3">
								<!-- Icon -->
								<div
									class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-cream)]"
								>
									<svg
										class="h-5 w-5 text-[var(--color-navy)]"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
										/>
									</svg>
								</div>

								<!-- Details -->
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="badge {getCallBadge(proposal.callName)}">
											{proposal.callName}
										</span>
										<span class="text-xs text-[var(--color-slate-light)]">
											{proposal.palletName}
										</span>
									</div>
									<p class="mt-1 text-sm text-[var(--color-navy)]">
										{getCallDescription(proposal)}
									</p>
								</div>
							</div>

							<!-- Timestamp -->
							<div class="text-right text-sm">
								<div class="font-medium text-[var(--color-navy)]">
									{getRelativeTime(proposal.createdAt)}
								</div>
								<div class="text-xs text-[var(--color-slate-light)]">
									{formatTimestamp(proposal.createdAt)}
								</div>
							</div>
						</div>

						<!-- Details grid -->
						<div class="mt-4 grid gap-4 sm:grid-cols-2">
							<div>
								<span
									class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
								>
									Created By
								</span>
								<button
									type="button"
									class="mt-1 block font-mono text-sm text-[var(--color-navy)] hover:text-[var(--color-teal)] hover:underline"
									onclick={() => navigateToBalance(proposal.createdBy)}
								>
									{formatAddress(proposal.createdBy, 8)}
								</button>
							</div>
							<div>
								<span
									class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
								>
									Call Hash
								</span>
								<code
									class="mt-1 block font-mono text-xs break-all text-[var(--color-slate)]"
									title={proposal.callHash}
								>
									{proposal.callHash.slice(0, 18)}...{proposal.callHash.slice(-8)}
								</code>
							</div>
						</div>

						<!-- Read-only notice -->
						<div
							class="mt-4 flex items-center gap-2 rounded-md bg-[var(--color-cream)] p-3 text-sm text-[var(--color-slate)]"
						>
							<svg
								class="h-4 w-4 flex-shrink-0"
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
							<span>
								This proposal is stored on CLAD Server. Use CLAD Mobile to submit and approve
								on-chain.
							</span>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Last refresh info -->
	{#if lastRefresh && serverConnectionState === 'connected' && !isLoading}
		<div class="text-sm text-[var(--color-slate-light)]">
			Last refreshed: {lastRefresh.toLocaleTimeString()}
			<span class="ml-2">(auto-refresh every 30s)</span>
		</div>
	{/if}
</div>
