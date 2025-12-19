<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		connect,
		disconnect,
		subscribeToConnectionState,
		type ConnectionState
	} from '$lib/substrate';
	import type { ApiPromise } from '@polkadot/api';

	let connectionState: ConnectionState = $state('disconnected');
	let api: ApiPromise | null = $state(null);
	let chainInfo = $state({
		name: '-',
		version: '-',
		genesisHash: '-'
	});
	let tokenInfo = $state({
		totalSupply: '-',
		decimals: 6
	});
	let latestBlock = $state({
		number: 0,
		hash: '-'
	});

	let unsubscribeState: (() => void) | null = null;
	let unsubscribeBlocks: (() => void) | null = null;

	onMount(async () => {
		// Subscribe to connection state
		unsubscribeState = subscribeToConnectionState((state) => {
			connectionState = state;
		});

		// Try to connect
		try {
			api = await connect();

			// Get chain info
			const [chain, nodeName, nodeVersion] = await Promise.all([
				api.rpc.system.chain(),
				api.rpc.system.name(),
				api.rpc.system.version()
			]);

			chainInfo = {
				name: chain.toString(),
				version: `${nodeName} ${nodeVersion}`,
				genesisHash: api.genesisHash.toHex().slice(0, 16) + '...'
			};

			// Subscribe to new blocks
			const unsub = await api.rpc.chain.subscribeNewHeads((header) => {
				latestBlock = {
					number: header.number.toNumber(),
					hash: header.hash.toHex().slice(0, 16) + '...'
				};
			});
			unsubscribeBlocks = unsub;

			// Try to get token info (if pallet-clad-token exists)
			try {
				const totalSupply = await api.query.cladToken?.totalSupply?.();
				if (totalSupply) {
					tokenInfo = {
						totalSupply: totalSupply.toString(),
						decimals: 6
					};
				}
			} catch {
				// pallet might not exist yet
			}
		} catch (error) {
			console.error('Failed to connect:', error);
		}
	});

	onDestroy(async () => {
		if (unsubscribeState) unsubscribeState();
		if (unsubscribeBlocks) unsubscribeBlocks();
		await disconnect();
	});

	function formatSupply(supply: string, decimals: number): string {
		if (supply === '-') return '-';
		const value = BigInt(supply);
		const divisor = BigInt(10 ** decimals);
		const intPart = value / divisor;
		return intPart.toLocaleString();
	}
</script>

<div class="space-y-6">
	<!-- Page Header -->
	<div>
		<h1 class="font-serif text-2xl text-[var(--color-navy)]">Dashboard Overview</h1>
		<p class="mt-1 text-sm text-[var(--color-text-muted)]">
			Monitor your Clad token infrastructure
		</p>
	</div>

	<!-- Stats Grid -->
	<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
		<!-- Connection Status -->
		<div class="card">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-medium text-[var(--color-slate-light)]">Node Status</h3>
				<div
					class="status-dot {connectionState === 'connected'
						? 'status-connected'
						: connectionState === 'connecting'
							? 'status-pending'
							: 'status-disconnected'}"
				></div>
			</div>
			<p class="mt-2 text-2xl font-semibold text-[var(--color-navy)]">
				{connectionState === 'connected'
					? 'Online'
					: connectionState === 'connecting'
						? 'Connecting'
						: 'Offline'}
			</p>
			<p class="mt-1 text-xs text-[var(--color-text-muted)]">
				{chainInfo.name}
			</p>
		</div>

		<!-- Latest Block -->
		<div class="card">
			<h3 class="text-sm font-medium text-[var(--color-slate-light)]">Latest Block</h3>
			<p class="mt-2 text-2xl font-semibold text-[var(--color-navy)]">
				#{latestBlock.number.toLocaleString()}
			</p>
			<p class="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
				{latestBlock.hash}
			</p>
		</div>

		<!-- Total Supply -->
		<div class="card">
			<h3 class="text-sm font-medium text-[var(--color-slate-light)]">CLAD Supply</h3>
			<p class="mt-2 text-2xl font-semibold text-[var(--color-navy)]">
				{formatSupply(tokenInfo.totalSupply, tokenInfo.decimals)}
			</p>
			<p class="mt-1 text-xs text-[var(--color-text-muted)]">Total minted tokens</p>
		</div>

		<!-- Node Version -->
		<div class="card">
			<h3 class="text-sm font-medium text-[var(--color-slate-light)]">Node Version</h3>
			<p class="mt-2 truncate text-lg font-semibold text-[var(--color-navy)]">
				{chainInfo.version}
			</p>
			<p class="mt-1 font-mono text-xs text-[var(--color-text-muted)]">
				{chainInfo.genesisHash}
			</p>
		</div>
	</div>

	<!-- Quick Actions -->
	<div class="card">
		<h2 class="text-lg font-semibold text-[var(--color-navy)]">Quick Actions</h2>
		<p class="mt-1 text-sm text-[var(--color-text-muted)]">
			Common operations for token management
		</p>
		<div class="mt-4 flex flex-wrap gap-3">
			<a href="/balances" class="btn btn-primary">
				<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
					/>
				</svg>
				Lookup Balance
			</a>
			<a href="/whitelist" class="btn btn-secondary">
				<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
				Check Whitelist
			</a>
			<a href="/events" class="btn btn-secondary">
				<svg class="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					/>
				</svg>
				View Events
			</a>
		</div>
	</div>

	<!-- Info Banner -->
	{#if connectionState === 'disconnected' || connectionState === 'error'}
		<div
			class="rounded-lg border border-[var(--color-warning)] bg-[var(--color-warning-muted)] p-4"
		>
			<div class="flex items-start gap-3">
				<svg
					class="h-5 w-5 text-[var(--color-warning)]"
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
					<h3 class="font-medium text-[#92400e]">Node Not Connected</h3>
					<p class="mt-1 text-sm text-[#92400e]/80">
						Unable to connect to the Clad node at ws://127.0.0.1:9944. Make sure your local node is
						running.
					</p>
					<p class="mt-2 font-mono text-xs text-[#92400e]/70">./target/release/clad-node --dev</p>
				</div>
			</div>
		</div>
	{/if}
</div>
