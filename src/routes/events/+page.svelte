<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { subscribeToConnectionState, getApiOrNull, type ConnectionState } from '$lib/substrate';
	import {
		TOKEN_CONFIG,
		formatBalance,
		formatAddress,
		type CladTokenEventType,
		type TokenEvent
	} from '$lib/substrate/types';
	import type { ApiPromise } from '@polkadot/api';

	// Connection state
	let connectionState: ConnectionState = $state('disconnected');
	let unsubscribeState: (() => void) | null = null;
	let unsubscribeBlocks: (() => void) | null = null;

	// Events state
	let events = $state<TokenEvent[]>([]);
	let isLoading = $state(false);
	let error = $state<string | null>(null);

	// localStorage keys
	const STORAGE_KEY = 'clad-token-events';
	const STORAGE_GENESIS_KEY = 'clad-token-events-genesis';

	/**
	 * Generate a consistent event ID based on event content
	 */
	function generateEventId(blockHash: string, type: string, data: Record<string, unknown>): string {
		// Create a deterministic ID from event content
		const dataStr = JSON.stringify(data);
		return `${blockHash}-${type}-${dataStr}`;
	}

	/**
	 * Load events from localStorage
	 */
	function loadEventsFromStorage(genesisHash: string): TokenEvent[] {
		try {
			const storedGenesis = localStorage.getItem(STORAGE_GENESIS_KEY);
			// Clear if from different chain
			if (storedGenesis && storedGenesis !== genesisHash) {
				localStorage.removeItem(STORAGE_KEY);
				localStorage.removeItem(STORAGE_GENESIS_KEY);
				return [];
			}

			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored) as TokenEvent[];
				// Migrate old events without id field or regenerate IDs for consistency
				const migrated = parsed.map((e) => ({
					...e,
					id: generateEventId(e.blockHash, e.type, e.data)
				}));
				return migrated;
			}
		} catch (e) {
			console.warn('Failed to load events from localStorage:', e);
			// Clear corrupted data
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(STORAGE_GENESIS_KEY);
		}
		return [];
	}

	/**
	 * Save events to localStorage
	 */
	function saveEventsToStorage(eventsToSave: TokenEvent[], genesisHash: string) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(eventsToSave));
			localStorage.setItem(STORAGE_GENESIS_KEY, genesisHash);
		} catch (e) {
			console.warn('Failed to save events to localStorage:', e);
		}
	}

	/**
	 * Clear stored events
	 */
	function clearStoredEvents() {
		try {
			localStorage.removeItem(STORAGE_KEY);
			localStorage.removeItem(STORAGE_GENESIS_KEY);
		} catch (e) {
			console.warn('Failed to clear localStorage:', e);
		}
		events = [];
	}

	// Filter state
	const eventTypes: CladTokenEventType[] = [
		'Minted',
		'Transferred',
		'Frozen',
		'Unfrozen',
		'Whitelisted',
		'RemovedFromWhitelist'
	];
	let selectedFilter = $state<CladTokenEventType | 'all'>('all');

	// Pagination state
	const PAGE_SIZE = 20;
	let currentPage = $state(1);

	// Event type colors for badges
	const eventColors: Record<CladTokenEventType, string> = {
		Minted: 'badge-success',
		Transferred: 'badge',
		Frozen: 'badge-error',
		Unfrozen: 'badge-success',
		Whitelisted: 'badge-success',
		RemovedFromWhitelist: 'badge-warning'
	};

	// Event type icons
	const eventIcons: Record<CladTokenEventType, string> = {
		Minted: 'M12 6v6m0 0v6m0-6h6m-6 0H6',
		Transferred: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
		Frozen:
			'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707',
		Unfrozen:
			'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707',
		Whitelisted: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
		RemovedFromWhitelist: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z'
	};

	// Filtered events
	let filteredEvents = $derived(
		selectedFilter === 'all' ? events : events.filter((e) => e.type === selectedFilter)
	);

	// Paginated events
	let paginatedEvents = $derived(
		filteredEvents.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
	);

	// Total pages
	let totalPages = $derived(Math.ceil(filteredEvents.length / PAGE_SIZE));

	onMount(() => {
		unsubscribeState = subscribeToConnectionState(async (state) => {
			connectionState = state;

			if (state === 'connected') {
				await startEventSubscription();
			} else {
				if (unsubscribeBlocks) {
					unsubscribeBlocks();
					unsubscribeBlocks = null;
				}
			}
		});
	});

	onDestroy(() => {
		if (unsubscribeState) unsubscribeState();
		if (unsubscribeBlocks) unsubscribeBlocks();
	});

	/**
	 * Parse events from a block
	 */
	function parseBlockEvents(
		blockNumber: number,
		blockHash: string,
		blockTimestamp: number | null,
		systemEvents: unknown[]
	): TokenEvent[] {
		const parsedEvents: TokenEvent[] = [];

		for (const record of systemEvents) {
			const eventRecord = record as {
				event: {
					section: string;
					method: string;
					data: unknown[];
				};
			};

			const { event } = eventRecord;

			// Filter for cladToken pallet events
			if (event.section !== 'cladToken') continue;

			const eventType = event.method as CladTokenEventType;
			if (!eventTypes.includes(eventType)) continue;

			// Parse event data based on type
			let data: Record<string, unknown> = {};

			switch (eventType) {
				case 'Minted':
					data = {
						to: event.data[0]?.toString() || '',
						amount: event.data[1]?.toString() || '0'
					};
					break;
				case 'Transferred':
					data = {
						from: event.data[0]?.toString() || '',
						to: event.data[1]?.toString() || '',
						amount: event.data[2]?.toString() || '0'
					};
					break;
				case 'Frozen':
				case 'Unfrozen':
					data = {
						account: event.data[0]?.toString() || ''
					};
					break;
				case 'Whitelisted':
				case 'RemovedFromWhitelist':
					data = {
						account: event.data[0]?.toString() || ''
					};
					break;
			}

			// Generate consistent ID based on event content
			const id = generateEventId(blockHash, eventType, data);

			parsedEvents.push({
				id,
				type: eventType,
				blockNumber,
				blockHash,
				timestamp: blockTimestamp,
				data
			});
		}

		return parsedEvents;
	}

	/**
	 * Get block timestamp from chain
	 */
	async function getBlockTimestamp(api: ApiPromise, blockHash: string): Promise<number | null> {
		try {
			const apiAt = await api.at(blockHash);
			// Query timestamp.now() which returns the timestamp set by the timestamp pallet
			const timestampResult = await apiAt.query.timestamp?.now?.();
			if (timestampResult) {
				// Timestamp is in milliseconds
				return Number(timestampResult.toString());
			}
		} catch (e) {
			console.warn('Failed to get block timestamp:', e);
		}
		return null;
	}

	/**
	 * Start subscribing to new blocks and their events
	 */
	async function startEventSubscription() {
		const api = getApiOrNull();
		if (!api) return;

		isLoading = true;
		error = null;

		const genesisHash = api.genesisHash.toHex();

		try {
			// Load previously stored events
			const storedEvents = loadEventsFromStorage(genesisHash);
			if (storedEvents.length > 0) {
				events = storedEvents;
			}

			// Fetch recent events from past blocks (will merge with stored)
			await fetchRecentEvents(api, genesisHash);

			// Then subscribe to new blocks
			const unsub = await api.rpc.chain.subscribeNewHeads(async (header) => {
				try {
					const blockHash = header.hash.toHex();
					const blockNumber = header.number.toNumber();

					// Get events and timestamp for this block
					const apiAt = await api.at(blockHash);
					const [systemEvents, blockTimestamp] = await Promise.all([
						apiAt.query.system.events(),
						getBlockTimestamp(api, blockHash)
					]);
					const eventsArray = (systemEvents as unknown as { toArray(): unknown[] }).toArray();

					const newEvents = parseBlockEvents(blockNumber, blockHash, blockTimestamp, eventsArray);

					if (newEvents.length > 0) {
						// Prepend new events and keep max 500
						const updatedEvents = [...newEvents, ...events].slice(0, 500);
						events = updatedEvents;
						// Persist to localStorage
						saveEventsToStorage(updatedEvents, genesisHash);
					}
				} catch (e) {
					console.error('Failed to process block events:', e);
				}
			});

			unsubscribeBlocks = unsub;
		} catch (e) {
			console.error('Failed to start event subscription:', e);
			error = e instanceof Error ? e.message : 'Failed to subscribe to events';
		} finally {
			isLoading = false;
		}
	}

	/**
	 * Fetch events from recent blocks and merge with existing
	 */
	async function fetchRecentEvents(api: ApiPromise, genesisHash: string) {
		try {
			const latestHeader = await api.rpc.chain.getHeader();
			const latestNumber = latestHeader.number.toNumber();

			// Fetch last 50 blocks (to avoid too much initial load)
			const blocksToFetch = Math.min(50, latestNumber);
			const blockPromises: Promise<TokenEvent[]>[] = [];

			for (let i = 0; i < blocksToFetch; i++) {
				const blockNum = latestNumber - i;
				blockPromises.push(fetchBlockEvents(api, blockNum));
			}

			const results = await Promise.all(blockPromises);
			const newEvents = results.flat();

			// Merge with existing events, avoiding duplicates by ID
			const existingIds = new Set(events.map((e) => e.id));
			const uniqueNewEvents = newEvents.filter((e) => !existingIds.has(e.id));

			// Combine and sort by block number (descending)
			const allEvents = [...uniqueNewEvents, ...events];
			allEvents.sort((a, b) => b.blockNumber - a.blockNumber);

			// Keep max 500 events
			const trimmedEvents = allEvents.slice(0, 500);
			events = trimmedEvents;

			// Persist to localStorage
			saveEventsToStorage(trimmedEvents, genesisHash);
		} catch (e) {
			console.error('Failed to fetch recent events:', e);
		}
	}

	/**
	 * Fetch events from a specific block
	 */
	async function fetchBlockEvents(api: ApiPromise, blockNumber: number): Promise<TokenEvent[]> {
		try {
			const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
			const blockHashHex = blockHash.toHex();
			const apiAt = await api.at(blockHash);

			const [systemEvents, blockTimestamp] = await Promise.all([
				apiAt.query.system.events(),
				getBlockTimestamp(api, blockHashHex)
			]);
			const eventsArray = (systemEvents as unknown as { toArray(): unknown[] }).toArray();

			return parseBlockEvents(blockNumber, blockHashHex, blockTimestamp, eventsArray);
		} catch {
			return [];
		}
	}

	/**
	 * Handle filter change
	 */
	function handleFilterChange(filter: CladTokenEventType | 'all') {
		selectedFilter = filter;
		currentPage = 1;
	}

	/**
	 * Navigate to balances page with address
	 */
	function navigateToBalance(address: string) {
		goto(`/balances?address=${encodeURIComponent(address)}`);
	}

	/**
	 * Format amount for display
	 */
	function formatAmount(amount: string): string {
		try {
			const value = BigInt(amount);
			return formatBalance(value, TOKEN_CONFIG.CLAD_DECIMALS);
		} catch {
			return amount;
		}
	}

	/**
	 * Format timestamp for display
	 */
	function formatTimestamp(timestamp: number | null): string {
		if (!timestamp) return '';
		const date = new Date(timestamp);
		// Format as "Dec 19, 3:45 PM"
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});
	}

	/**
	 * Export events to CSV
	 */
	function exportCSV() {
		if (filteredEvents.length === 0) return;

		const headers = ['Type', 'Block', 'Block Hash', 'Timestamp', 'Account/From', 'To', 'Amount'];
		const rows = filteredEvents.map((e) => {
			const from = (e.data.from || e.data.account || '') as string;
			const to = (e.data.to || '') as string;
			const amount = e.data.amount ? formatAmount(e.data.amount as string) : '';
			const timestamp = e.timestamp ? new Date(e.timestamp).toISOString() : '';

			return [e.type, e.blockNumber.toString(), e.blockHash, timestamp, from, to, amount];
		});

		const csvContent = [headers, ...rows]
			.map((row) => row.map((cell) => `"${cell}"`).join(','))
			.join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const filename = `clad-events-${new Date().toISOString().split('T')[0]}.csv`;

		const link = document.createElement('a');
		link.style.cssText = 'position:fixed;left:-9999px';
		link.href = url;
		link.download = filename;
		link.setAttribute('data-sveltekit-reload', '');
		document.body.appendChild(link);

		setTimeout(() => {
			link.click();
			setTimeout(() => {
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
			}, 100);
		}, 0);
	}

	/**
	 * Go to page
	 */
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			currentPage = page;
		}
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex items-start justify-between">
		<div>
			<h1 class="font-serif text-2xl text-[var(--color-navy)]">Token Events</h1>
			<p class="mt-1 text-sm text-[var(--color-text-muted)]">
				Real-time event history from the CLAD token pallet
			</p>
		</div>
		{#if events.length > 0}
			<div class="flex gap-2">
				<button type="button" class="btn btn-secondary" onclick={exportCSV}>
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
				<button
					type="button"
					class="btn btn-secondary text-[var(--color-error)]"
					onclick={clearStoredEvents}
					title="Clear event history from local storage"
				>
					<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
						/>
					</svg>
					Clear
				</button>
			</div>
		{/if}
	</div>

	<!-- Filters -->
	<div class="card">
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-sm font-medium text-[var(--color-slate)]">Filter by type:</span>
			<button
				type="button"
				class="rounded-full px-3 py-1 text-sm transition-colors {selectedFilter === 'all'
					? 'bg-[var(--color-navy)] text-white'
					: 'bg-[var(--color-cream)] text-[var(--color-slate)] hover:bg-[var(--color-border)]'}"
				onclick={() => handleFilterChange('all')}
			>
				All ({events.length})
			</button>
			{#each eventTypes as eventType (eventType)}
				{@const count = events.filter((e) => e.type === eventType).length}
				<button
					type="button"
					class="rounded-full px-3 py-1 text-sm transition-colors {selectedFilter === eventType
						? 'bg-[var(--color-navy)] text-white'
						: 'bg-[var(--color-cream)] text-[var(--color-slate)] hover:bg-[var(--color-border)]'}"
					onclick={() => handleFilterChange(eventType)}
				>
					{eventType} ({count})
				</button>
			{/each}
		</div>
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
				<span class="ml-3 text-[var(--color-slate)]">Loading events...</span>
			</div>
		</div>
	{/if}

	<!-- Events list -->
	{#if !isLoading && connectionState === 'connected'}
		{#if filteredEvents.length === 0}
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
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						/>
					</svg>
					<p class="mt-4 text-[var(--color-slate)]">No events found</p>
					<p class="mt-1 text-sm text-[var(--color-slate-light)]">
						{selectedFilter === 'all'
							? 'Events will appear here as they occur on the chain'
							: `No ${selectedFilter} events recorded yet`}
					</p>
				</div>
			</div>
		{:else}
			<div class="card overflow-hidden p-0">
				<table class="w-full">
					<thead>
						<tr class="border-b border-[var(--color-border)] bg-[var(--color-cream)]">
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wide text-[var(--color-slate)] uppercase"
							>
								Event
							</th>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wide text-[var(--color-slate)] uppercase"
							>
								Block
							</th>
							<th
								class="px-4 py-3 text-left text-xs font-medium tracking-wide text-[var(--color-slate)] uppercase"
							>
								Details
							</th>
							<th
								class="px-4 py-3 text-right text-xs font-medium tracking-wide text-[var(--color-slate)] uppercase"
							>
								Amount
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-[var(--color-border)]">
						{#each paginatedEvents as event (event.id)}
							<tr class="hover:bg-[var(--color-cream)]/50">
								<td class="px-4 py-3">
									<span class={`badge ${eventColors[event.type]}`}>
										<svg
											class="mr-1.5 h-3 w-3"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor"
										>
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d={eventIcons[event.type]}
											/>
										</svg>
										{event.type}
									</span>
								</td>
								<td class="px-4 py-3">
									<div class="flex flex-col gap-0.5">
										<span class="font-mono text-sm text-[var(--color-navy)]">
											#{event.blockNumber.toLocaleString()}
										</span>
										<span class="font-mono text-xs text-[var(--color-slate-light)]">
											{event.blockHash.slice(0, 10)}...
										</span>
										{#if event.timestamp}
											<span class="text-xs text-[var(--color-slate)]">
												{formatTimestamp(event.timestamp)}
											</span>
										{/if}
									</div>
								</td>
								<td class="px-4 py-3">
									<div class="space-y-1">
										{#if event.data.from}
											<div class="flex items-center gap-1 text-sm">
												<span class="text-[var(--color-slate-light)]">From:</span>
												<button
													type="button"
													class="font-mono text-[var(--color-navy)] hover:text-[var(--color-teal)] hover:underline"
													onclick={() => navigateToBalance(event.data.from as string)}
												>
													{formatAddress(event.data.from as string, 8)}
												</button>
											</div>
										{/if}
										{#if event.data.to}
											<div class="flex items-center gap-1 text-sm">
												<span class="text-[var(--color-slate-light)]">To:</span>
												<button
													type="button"
													class="font-mono text-[var(--color-navy)] hover:text-[var(--color-teal)] hover:underline"
													onclick={() => navigateToBalance(event.data.to as string)}
												>
													{formatAddress(event.data.to as string, 8)}
												</button>
											</div>
										{/if}
										{#if event.data.account}
											<div class="flex items-center gap-1 text-sm">
												<span class="text-[var(--color-slate-light)]">Account:</span>
												<button
													type="button"
													class="font-mono text-[var(--color-navy)] hover:text-[var(--color-teal)] hover:underline"
													onclick={() => navigateToBalance(event.data.account as string)}
												>
													{formatAddress(event.data.account as string, 8)}
												</button>
											</div>
										{/if}
									</div>
								</td>
								<td class="px-4 py-3 text-right">
									{#if event.data.amount}
										<span class="font-mono text-sm font-medium text-[var(--color-navy)]">
											{formatAmount(event.data.amount as string)}
										</span>
										<span class="ml-1 text-xs text-[var(--color-slate-light)]">CLAD</span>
									{:else}
										<span class="text-[var(--color-slate-light)]">-</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- Pagination -->
			{#if totalPages > 1}
				<div class="flex items-center justify-between">
					<p class="text-sm text-[var(--color-slate)]">
						Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(
							currentPage * PAGE_SIZE,
							filteredEvents.length
						)} of {filteredEvents.length} events
					</p>
					<div class="flex items-center gap-2">
						<button
							type="button"
							class="btn btn-secondary"
							disabled={currentPage === 1}
							onclick={() => goToPage(currentPage - 1)}
							aria-label="Previous page"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 19l-7-7 7-7"
								/>
							</svg>
						</button>
						<span class="text-sm text-[var(--color-slate)]">
							Page {currentPage} of {totalPages}
						</span>
						<button
							type="button"
							class="btn btn-secondary"
							disabled={currentPage === totalPages}
							onclick={() => goToPage(currentPage + 1)}
							aria-label="Next page"
						>
							<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</button>
					</div>
				</div>
			{/if}
		{/if}
	{/if}

	<!-- Info about real-time updates -->
	{#if connectionState === 'connected' && !isLoading && events.length > 0}
		<div class="flex items-center gap-2 text-sm text-[var(--color-slate-light)]">
			<span class="relative flex h-2 w-2">
				<span
					class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-75"
				></span>
				<span class="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-success)]"></span>
			</span>
			Live updates - new events appear automatically
		</div>
	{/if}
</div>
