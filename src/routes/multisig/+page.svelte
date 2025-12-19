<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { subscribeToConnectionState, getApiOrNull, type ConnectionState } from '$lib/substrate';
	import {
		TOKEN_CONFIG,
		formatBalance,
		formatAddress,
		type PendingProposal,
		type TokenOperation,
		type MultisigTimepoint
	} from '$lib/substrate/types';
	import { getMultisigConfig, getSignatoryDisplayName } from '$lib/config/multisig-accounts';
	import { formatDateTime } from '$lib/utils';
	import type { ApiPromise } from '@polkadot/api';

	// Connection state
	let connectionState: ConnectionState = $state('disconnected');
	let unsubscribeState: (() => void) | null = null;

	// Data state
	let proposals = $state<PendingProposal[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);
	let lastRefresh = $state<Date | null>(null);

	// Multisig account input for filtering
	let multisigAccountInput = $state('');
	let activeMultisigAccount = $state<string | null>(null);

	onMount(() => {
		unsubscribeState = subscribeToConnectionState(async (state) => {
			connectionState = state;

			if (state === 'connected') {
				await fetchPendingProposals();
			}
		});
	});

	onDestroy(() => {
		if (unsubscribeState) unsubscribeState();
	});

	/**
	 * Get block timestamp from chain
	 */
	async function getBlockTimestamp(api: ApiPromise, blockNumber: number): Promise<number | null> {
		try {
			const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
			const apiAt = await api.at(blockHash);
			const timestampResult = await apiAt.query.timestamp?.now?.();
			if (timestampResult) {
				return Number(timestampResult.toString());
			}
		} catch (e) {
			console.warn('Failed to get block timestamp:', e);
		}
		return null;
	}

	/**
	 * Parse multisig storage value
	 * Storage format: { when: Timepoint, deposit: u128, depositor: AccountId, approvals: Vec<AccountId> }
	 */
	function parseMultisigValue(
		value: unknown
	): { when: MultisigTimepoint; deposit: bigint; depositor: string; approvals: string[] } | null {
		try {
			const v = value as {
				when: { height: { toNumber(): number }; index: { toNumber(): number } };
				deposit: { toString(): string };
				depositor: { toString(): string };
				approvals: { map(fn: (a: unknown) => string): string[] };
			};

			return {
				when: {
					height: v.when.height.toNumber(),
					index: v.when.index.toNumber()
				},
				deposit: BigInt(v.deposit.toString()),
				depositor: v.depositor.toString(),
				approvals: v.approvals.map((a: unknown) => (a as { toString(): string }).toString())
			};
		} catch (e) {
			console.warn('Failed to parse multisig value:', e);
			return null;
		}
	}

	/**
	 * Fetch all pending multisig proposals
	 */
	async function fetchPendingProposals() {
		const api = getApiOrNull();
		if (!api) return;

		isLoading = true;
		error = null;

		try {
			// Check if multisig pallet exists
			if (!api.query.multisig) {
				console.warn('Multisig pallet not found in runtime');
				error = 'Multisig pallet not available on this chain';
				proposals = [];
				lastRefresh = new Date();
				return;
			}

			// Query all multisig entries
			const entries = await api.query.multisig.multisigs.entries();
			if (!entries || entries.length === 0) {
				proposals = [];
				lastRefresh = new Date();
				return;
			}

			// First pass: parse all entries and collect unique block heights
			const parsedEntries: Array<{
				multisigAccount: string;
				callHash: string;
				parsed: {
					when: MultisigTimepoint;
					deposit: bigint;
					depositor: string;
					approvals: string[];
				};
			}> = [];
			const blockHeightsList: number[] = [];

			for (const [key, value] of entries) {
				// Key structure: [multisigAccount, callHash]
				const keyArgs = key.args;
				if (keyArgs.length < 2) continue;

				const multisigAccount = keyArgs[0].toString();
				const callHash = keyArgs[1].toHex();

				// Skip if filtering by multisig account
				if (activeMultisigAccount && multisigAccount !== activeMultisigAccount) {
					continue;
				}

				// Value is Option<Multisig>, check if it has a value
				const optionValue = value as unknown as { isSome?: boolean; unwrap?: () => unknown };
				if (optionValue.isSome === false) {
					continue;
				}

				// Unwrap if it's an Option type
				const unwrappedValue = optionValue.unwrap ? optionValue.unwrap() : value;

				const parsed = parseMultisigValue(unwrappedValue);
				if (!parsed) continue;

				parsedEntries.push({ multisigAccount, callHash, parsed });
				if (!blockHeightsList.includes(parsed.when.height)) {
					blockHeightsList.push(parsed.when.height);
				}
			}

			// Fetch all timestamps in parallel
			const timestampResults = await Promise.all(
				blockHeightsList.map(async (height) => ({
					height,
					timestamp: await getBlockTimestamp(api, height)
				}))
			);
			const timestampLookup: Record<number, number | null> = {};
			for (const { height, timestamp } of timestampResults) {
				timestampLookup[height] = timestamp;
			}

			// Second pass: build proposals with cached timestamps
			const parsedProposals: PendingProposal[] = [];

			for (const { multisigAccount, callHash, parsed } of parsedEntries) {
				// For now, we don't have call data decoding, so operation is Unknown
				// In production, this would be fetched from an off-chain indexer
				const operation: TokenOperation = {
					type: 'Unknown',
					params: {}
				};

				// Look up multisig configuration (threshold, signatories)
				const config = getMultisigConfig(multisigAccount);

				const proposal: PendingProposal = {
					id: `${multisigAccount}-${callHash}`,
					multisigAccount,
					callHash,
					operation,
					depositor: parsed.depositor,
					deposit: parsed.deposit,
					approvals: parsed.approvals,
					threshold: config?.threshold ?? 0,
					signatories: config?.signatories.map((s) => s.address) ?? [],
					when: parsed.when,
					timestamp: timestampLookup[parsed.when.height] ?? null
				};

				parsedProposals.push(proposal);
			}

			// Sort by block height (newest first)
			parsedProposals.sort((a, b) => b.when.height - a.when.height);

			proposals = parsedProposals;
			lastRefresh = new Date();
		} catch (e) {
			console.error('Failed to fetch pending proposals:', e);
			error = e instanceof Error ? e.message : 'Failed to fetch pending proposals';
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Refresh proposals
	 */
	async function refresh() {
		await fetchPendingProposals();
	}

	/**
	 * Filter by multisig account
	 */
	function applyFilter(e?: Event) {
		e?.preventDefault();
		activeMultisigAccount = multisigAccountInput.trim() || null;
		fetchPendingProposals();
	}

	/**
	 * Clear filter
	 */
	function clearFilter() {
		multisigAccountInput = '';
		activeMultisigAccount = null;
		fetchPendingProposals();
	}

	/**
	 * Navigate to balances page with address
	 */
	function navigateToBalance(address: string) {
		goto(`/balances?address=${encodeURIComponent(address)}`);
	}

	/**
	 * Format deposit amount
	 */
	function formatDeposit(deposit: bigint): string {
		return formatBalance(deposit, TOKEN_CONFIG.NATIVE_DECIMALS);
	}

	/**
	 * Format timestamp for display (locale-aware)
	 */
	function formatTimestamp(timestamp: number | null): string {
		if (!timestamp) return 'Unknown';
		return formatDateTime(timestamp, 'medium', 'short');
	}

	/**
	 * Get operation display text
	 */
	function getOperationDisplay(operation: TokenOperation): {
		title: string;
		description: string;
		badge: string;
	} {
		switch (operation.type) {
			case 'Mint':
				return {
					title: 'Mint Tokens',
					description: operation.params.to
						? `Mint ${operation.params.amount ? formatBalance(operation.params.amount, TOKEN_CONFIG.CLAD_DECIMALS) : '?'} CLAD to ${formatAddress(operation.params.to, 6)}`
						: 'Mint tokens',
					badge: 'badge-success'
				};
			case 'Transfer':
				return {
					title: 'Transfer Tokens',
					description: 'Transfer tokens between accounts',
					badge: 'badge'
				};
			case 'Freeze':
				return {
					title: 'Freeze Account',
					description: operation.params.account
						? `Freeze ${formatAddress(operation.params.account, 6)}`
						: 'Freeze an account',
					badge: 'badge-error'
				};
			case 'Unfreeze':
				return {
					title: 'Unfreeze Account',
					description: operation.params.account
						? `Unfreeze ${formatAddress(operation.params.account, 6)}`
						: 'Unfreeze an account',
					badge: 'badge-success'
				};
			case 'AddToWhitelist':
				return {
					title: 'Add to Whitelist',
					description: operation.params.account
						? `Whitelist ${formatAddress(operation.params.account, 6)}`
						: 'Add account to whitelist',
					badge: 'badge-success'
				};
			case 'RemoveFromWhitelist':
				return {
					title: 'Remove from Whitelist',
					description: operation.params.account
						? `Remove ${formatAddress(operation.params.account, 6)} from whitelist`
						: 'Remove account from whitelist',
					badge: 'badge-warning'
				};
			case 'SetAdmin':
				return {
					title: 'Set Admin',
					description: operation.params.newAdmin
						? `Set admin to ${formatAddress(operation.params.newAdmin, 6)}`
						: 'Change admin account',
					badge: 'badge-warning'
				};
			default:
				return {
					title: 'Unknown Operation',
					description: 'Call data not available',
					badge: 'badge'
				};
		}
	}

	/**
	 * Get approval progress percentage
	 */
	function getApprovalProgress(approvals: number, threshold: number): number {
		if (threshold === 0) return 0;
		return Math.min((approvals / threshold) * 100, 100);
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="font-serif text-2xl text-[var(--color-navy)]">Pending Approvals</h1>
			<p class="mt-1 text-sm text-[var(--color-text-muted)]">
				Multi-signature operations awaiting approval
			</p>
		</div>
		<button
			type="button"
			class="btn btn-secondary"
			onclick={refresh}
			disabled={isLoading || connectionState !== 'connected'}
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

	<!-- Filter -->
	<div class="card">
		<form onsubmit={applyFilter} class="flex flex-wrap items-end gap-4">
			<div class="min-w-[300px] flex-1">
				<label for="multisig-account" class="block text-sm font-medium text-[var(--color-slate)]">
					Filter by Multi-sig Account
				</label>
				<input
					type="text"
					id="multisig-account"
					bind:value={multisigAccountInput}
					placeholder="Enter multi-sig account address (optional)"
					class="mt-1 w-full rounded-md border border-[var(--color-border)] px-3 py-2 font-mono text-sm placeholder:text-[var(--color-slate-light)] focus:border-[var(--color-navy)] focus:ring-1 focus:ring-[var(--color-navy)] focus:outline-none"
					disabled={connectionState !== 'connected' || isLoading}
				/>
			</div>
			<div class="flex gap-2">
				<button
					type="submit"
					class="btn btn-primary"
					disabled={connectionState !== 'connected' || isLoading}
				>
					Apply Filter
				</button>
				{#if activeMultisigAccount}
					<button type="button" class="btn btn-secondary" onclick={clearFilter}> Clear </button>
				{/if}
			</div>
		</form>
		{#if activeMultisigAccount}
			<div class="mt-3 text-sm text-[var(--color-slate)]">
				Showing proposals for: <code class="font-mono text-[var(--color-navy)]"
					>{formatAddress(activeMultisigAccount, 8)}</code
				>
			</div>
		{/if}
	</div>

	<!-- Connection warning -->
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

	<!-- Loading state -->
	{#if isLoading}
		<div class="card">
			<div class="flex items-center justify-center py-12">
				<svg class="h-8 w-8 animate-spin text-[var(--color-navy)]" viewBox="0 0 24 24" fill="none">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
				<span class="ml-3 text-[var(--color-slate)]">Loading pending approvals...</span>
			</div>
		</div>
	{/if}

	<!-- Proposals list -->
	{#if !isLoading && connectionState === 'connected'}
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
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<p class="mt-4 text-[var(--color-slate)]">No pending approvals</p>
					<p class="mt-1 text-sm text-[var(--color-slate-light)]">
						{activeMultisigAccount
							? 'No pending operations for this multi-sig account'
							: 'All multi-signature operations have been completed or cancelled'}
					</p>
				</div>
			</div>
		{:else}
			<div class="space-y-4">
				{#each proposals as proposal (proposal.id)}
					{@const opDisplay = getOperationDisplay(proposal.operation)}
					{@const proposalConfig = getMultisigConfig(proposal.multisigAccount)}
					<div class="card">
						<div class="flex items-start justify-between">
							<div class="flex items-start gap-3">
								<!-- Operation Icon -->
								<div
									class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-cream)]"
								>
									{#if proposal.operation.type === 'Unknown'}
										<svg
											class="h-5 w-5 text-[var(--color-slate)]"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
											/>
										</svg>
									{:else}
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
									{/if}
								</div>

								<!-- Operation Info -->
								<div>
									<div class="flex items-center gap-2">
										<h3 class="font-medium text-[var(--color-navy)]">{opDisplay.title}</h3>
										<span class={`badge ${opDisplay.badge}`}>{proposal.operation.type}</span>
									</div>
									<p class="mt-0.5 text-sm text-[var(--color-slate)]">
										{opDisplay.description}
									</p>
								</div>
							</div>

							<!-- Approval Status -->
							<div class="text-right">
								<div class="text-sm font-medium text-[var(--color-navy)]">
									{proposal.approvals.length} approval{proposal.approvals.length !== 1 ? 's' : ''}
								</div>
								{#if proposal.threshold > 0}
									<div class="text-xs text-[var(--color-slate-light)]">
										of {proposal.threshold} required
									</div>
								{/if}
							</div>
						</div>

						<!-- Progress Bar (if threshold known) -->
						{#if proposal.threshold > 0}
							<div class="mt-4">
								<div class="h-2 rounded-full bg-[var(--color-cream)]">
									<div
										class="h-2 rounded-full bg-[var(--color-teal)] transition-all"
										style="width: {getApprovalProgress(
											proposal.approvals.length,
											proposal.threshold
										)}%"
									></div>
								</div>
							</div>
						{/if}

						<!-- Details -->
						<div class="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
							<!-- Multi-sig Account -->
							<div>
								<span
									class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
								>
									Multi-sig Account
								</span>
								<div class="mt-1">
									{#if proposalConfig}
										<div class="text-sm font-medium text-[var(--color-navy)]">
											{proposalConfig.name}
										</div>
									{/if}
									<button
										type="button"
										class="block font-mono text-sm text-[var(--color-navy)] hover:text-[var(--color-teal)] hover:underline"
										onclick={() => navigateToBalance(proposal.multisigAccount)}
									>
										{formatAddress(proposal.multisigAccount, 8)}
									</button>
								</div>
							</div>

							<!-- Proposer -->
							<div>
								<span
									class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
								>
									Proposed By
								</span>
								<div class="mt-1">
									{#if getSignatoryDisplayName(proposal.depositor, proposalConfig)}
										<div class="text-sm font-medium text-[var(--color-navy)]">
											{getSignatoryDisplayName(proposal.depositor, proposalConfig)}
										</div>
									{/if}
									<button
										type="button"
										class="block font-mono text-sm text-[var(--color-navy)] hover:text-[var(--color-teal)] hover:underline"
										onclick={() => navigateToBalance(proposal.depositor)}
									>
										{formatAddress(proposal.depositor, 8)}
									</button>
								</div>
							</div>

							<!-- When -->
							<div>
								<span
									class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
								>
									Proposed At
								</span>
								<div class="mt-1 text-sm text-[var(--color-navy)]">
									Block #{proposal.when.height.toLocaleString()}
									{#if proposal.timestamp}
										<span class="text-[var(--color-slate-light)]">
											({formatTimestamp(proposal.timestamp)})
										</span>
									{/if}
								</div>
							</div>
						</div>

						<!-- Signatories List -->
						{#if proposalConfig && proposal.signatories.length > 0}
							<div class="mt-4">
								<span
									class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
								>
									Signatories ({proposal.approvals.length} of {proposal.threshold} approved)
								</span>
								<div class="mt-2 flex flex-wrap gap-2">
									{#each proposal.signatories as signatory (signatory)}
										{@const hasApproved = proposal.approvals.includes(signatory)}
										{@const displayName = getSignatoryDisplayName(signatory, proposalConfig)}
										<button
											type="button"
											class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm {hasApproved
												? 'bg-[var(--color-success-muted)] text-[var(--color-success)]'
												: 'bg-[var(--color-cream)] text-[var(--color-slate)]'} hover:opacity-80"
											onclick={() => navigateToBalance(signatory)}
										>
											{#if hasApproved}
												<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M5 13l4 4L19 7"
													/>
												</svg>
											{:else}
												<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
													/>
												</svg>
											{/if}
											{displayName || formatAddress(signatory, 6)}
										</button>
									{/each}
								</div>
							</div>
						{:else if proposal.approvals.length > 0}
							<!-- Fallback: show only approved addresses if no config -->
							<div class="mt-4">
								<span
									class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
								>
									Approved By
								</span>
								<div class="mt-2 flex flex-wrap gap-2">
									{#each proposal.approvals as approval (approval)}
										<button
											type="button"
											class="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-muted)] px-3 py-1 font-mono text-sm text-[var(--color-success)] hover:bg-[var(--color-success)]/20"
											onclick={() => navigateToBalance(approval)}
										>
											<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 13l4 4L19 7"
												/>
											</svg>
											{formatAddress(approval, 6)}
										</button>
									{/each}
								</div>
							</div>
						{/if}

						<!-- Call Hash -->
						<div class="mt-4 border-t border-[var(--color-border)] pt-4">
							<div class="flex items-center justify-between">
								<div>
									<span
										class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
									>
										Call Hash
									</span>
									<code class="mt-1 block font-mono text-xs break-all text-[var(--color-slate)]">
										{proposal.callHash}
									</code>
								</div>
								<div class="text-right">
									<span
										class="text-xs font-medium tracking-wide text-[var(--color-slate-light)] uppercase"
									>
										Deposit
									</span>
									<div class="mt-1 text-sm text-[var(--color-navy)]">
										{formatDeposit(proposal.deposit)} tokens
									</div>
								</div>
							</div>
						</div>

						<!-- Read-only notice -->
						<div
							class="mt-4 flex items-center gap-2 rounded-md bg-[var(--color-cream)] p-3 text-sm text-[var(--color-slate)]"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
								/>
							</svg>
							This is a read-only view. Use CLAD Mobile to approve or cancel this operation.
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}

	<!-- Last refresh info -->
	{#if lastRefresh && connectionState === 'connected' && !isLoading}
		<div class="text-sm text-[var(--color-slate-light)]">
			Last refreshed: {lastRefresh.toLocaleTimeString()}
		</div>
	{/if}
</div>
