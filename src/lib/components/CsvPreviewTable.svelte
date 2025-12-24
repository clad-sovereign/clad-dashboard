<script lang="ts">
	import { formatAddress } from '$lib/substrate/types';
	import type { CsvParseResult, ParsedAddress } from '$lib/utils';

	interface Props {
		/** The parsed CSV result to display */
		result: CsvParseResult;
		/** The file name for display */
		fileName: string;
		/** Callback when user wants to clear the preview */
		onClear: () => void;
		/** Callback when user wants to proceed with valid addresses */
		onProceed: (addresses: string[]) => void;
		/** Whether proceeding is disabled (e.g., during submission) */
		proceedDisabled?: boolean;
	}

	let { result, fileName, onClear, onProceed, proceedDisabled = false }: Props = $props();

	// Filter options
	let showFilter = $state<'all' | 'valid' | 'invalid' | 'duplicate' | 'already_whitelisted'>('all');

	// Get filtered entries
	let filteredEntries = $derived.by(() => {
		if (showFilter === 'all') {
			return result.entries;
		}
		return result.entries.filter((e) => e.status === showFilter);
	});

	// Get valid addresses for proceeding
	function getValidAddresses(): string[] {
		return result.entries.filter((e) => e.status === 'valid').map((e) => e.normalizedAddress!);
	}

	// Get badge class for status
	function getStatusBadge(status: ParsedAddress['status']): {
		class: string;
		label: string;
		icon: string;
	} {
		switch (status) {
			case 'valid':
				return {
					class: 'badge-success',
					label: 'Valid',
					icon: 'M5 13l4 4L19 7'
				};
			case 'invalid':
				return {
					class: 'badge-error',
					label: 'Invalid',
					icon: 'M6 18L18 6M6 6l12 12'
				};
			case 'duplicate':
				return {
					class: 'badge-warning',
					label: 'Duplicate',
					icon: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z'
				};
			case 'already_whitelisted':
				return {
					class: 'badge',
					label: 'On Whitelist',
					icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
				};
		}
	}
</script>

<div class="space-y-4">
	<!-- Summary Card -->
	<div class="card">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div class="flex items-center gap-3">
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
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						/>
					</svg>
				</div>
				<div>
					<h3 class="font-medium text-[var(--color-navy)]">{fileName}</h3>
					<p class="text-sm text-[var(--color-slate-light)]">
						{result.entries.length} address{result.entries.length !== 1 ? 'es' : ''} found
					</p>
				</div>
			</div>
			<button type="button" class="btn btn-secondary text-sm" onclick={onClear}>
				<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
				Clear
			</button>
		</div>

		<!-- Stats -->
		<div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
			<button
				type="button"
				class="rounded-lg p-3 text-left transition-colors {showFilter === 'valid'
					? 'bg-[var(--color-success-muted)] ring-2 ring-[var(--color-success)]'
					: 'bg-[var(--color-cream)] hover:bg-[var(--color-cream)]/80'}"
				onclick={() => (showFilter = showFilter === 'valid' ? 'all' : 'valid')}
			>
				<div class="text-2xl font-semibold text-[var(--color-success)]">{result.validCount}</div>
				<div class="text-xs text-[var(--color-slate-light)]">Valid</div>
			</button>
			<button
				type="button"
				class="rounded-lg p-3 text-left transition-colors {showFilter === 'invalid'
					? 'bg-[var(--color-error-muted)] ring-2 ring-[var(--color-error)]'
					: 'bg-[var(--color-cream)] hover:bg-[var(--color-cream)]/80'}"
				onclick={() => (showFilter = showFilter === 'invalid' ? 'all' : 'invalid')}
			>
				<div class="text-2xl font-semibold text-[var(--color-error)]">{result.invalidCount}</div>
				<div class="text-xs text-[var(--color-slate-light)]">Invalid</div>
			</button>
			<button
				type="button"
				class="rounded-lg p-3 text-left transition-colors {showFilter === 'duplicate'
					? 'bg-[var(--color-warning-muted)] ring-2 ring-[var(--color-warning)]'
					: 'bg-[var(--color-cream)] hover:bg-[var(--color-cream)]/80'}"
				onclick={() => (showFilter = showFilter === 'duplicate' ? 'all' : 'duplicate')}
			>
				<div class="text-2xl font-semibold text-[var(--color-warning)]">
					{result.duplicateCount}
				</div>
				<div class="text-xs text-[var(--color-slate-light)]">Duplicates</div>
			</button>
			<button
				type="button"
				class="rounded-lg p-3 text-left transition-colors {showFilter === 'already_whitelisted'
					? 'bg-[var(--color-cream)] ring-2 ring-[var(--color-slate)]'
					: 'bg-[var(--color-cream)] hover:bg-[var(--color-cream)]/80'}"
				onclick={() =>
					(showFilter = showFilter === 'already_whitelisted' ? 'all' : 'already_whitelisted')}
			>
				<div class="text-2xl font-semibold text-[var(--color-slate)]">
					{result.alreadyWhitelistedCount}
				</div>
				<div class="text-xs text-[var(--color-slate-light)]">Already Listed</div>
			</button>
		</div>
	</div>

	<!-- Address Table -->
	<div class="card overflow-hidden p-0">
		<div class="max-h-80 overflow-y-auto">
			<table class="w-full">
				<thead class="sticky top-0 bg-[var(--color-cream)]">
					<tr class="border-b border-[var(--color-border)]">
						<th
							class="px-4 py-3 text-left text-xs font-medium tracking-wide text-[var(--color-slate)] uppercase"
						>
							Line
						</th>
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
					{#each filteredEntries as entry (entry.lineNumber)}
						{@const badge = getStatusBadge(entry.status)}
						<tr class="hover:bg-[var(--color-cream)]/50">
							<td class="px-4 py-3 text-sm text-[var(--color-slate-light)]">
								{entry.lineNumber}
							</td>
							<td class="px-4 py-3">
								<code class="font-mono text-sm text-[var(--color-navy)]">
									{entry.normalizedAddress
										? formatAddress(entry.normalizedAddress, 8)
										: entry.originalAddress}
								</code>
								{#if entry.normalizedAddress && entry.originalAddress !== entry.normalizedAddress}
									<div class="mt-0.5 text-xs text-[var(--color-slate-light)]">
										Original: {entry.originalAddress.slice(0, 20)}...
									</div>
								{/if}
							</td>
							<td class="px-4 py-3">
								<span class="badge {badge.class} inline-flex items-center gap-1">
									<svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d={badge.icon}
										/>
									</svg>
									{badge.label}
								</span>
								{#if entry.error}
									<div class="mt-1 text-xs text-[var(--color-slate-light)]">{entry.error}</div>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>

	<!-- Action Buttons -->
	{#if result.validCount > 0}
		<div class="flex items-center justify-between">
			<p class="text-sm text-[var(--color-slate)]">
				{result.validCount} valid address{result.validCount !== 1 ? 'es' : ''} will be added to whitelist
				proposals
			</p>
			<button
				type="button"
				class="btn btn-primary"
				onclick={() => onProceed(getValidAddresses())}
				disabled={proceedDisabled || result.validCount === 0}
			>
				{#if proceedDisabled}
					<svg class="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Creating Proposals...
				{:else}
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 6v6m0 0v6m0-6h6m-6 0H6"
						/>
					</svg>
					Create Proposals ({result.validCount})
				{/if}
			</button>
		</div>
	{:else}
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
				No valid addresses to add. Please check your CSV file and try again.
			</div>
		</div>
	{/if}
</div>
