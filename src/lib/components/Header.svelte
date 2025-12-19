<script lang="ts">
	import { subscribeToConnectionState, type ConnectionState } from '$lib/substrate';
	import { onMount, onDestroy } from 'svelte';

	let connectionState: ConnectionState = $state('disconnected');
	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		unsubscribe = subscribeToConnectionState((state) => {
			connectionState = state;
		});
	});

	onDestroy(() => {
		if (unsubscribe) unsubscribe();
	});

	const statusColors: Record<ConnectionState, string> = {
		connected: 'status-connected',
		connecting: 'status-pending',
		disconnected: 'status-disconnected',
		error: 'status-disconnected'
	};

	const statusLabels: Record<ConnectionState, string> = {
		connected: 'Connected',
		connecting: 'Connecting...',
		disconnected: 'Disconnected',
		error: 'Error'
	};
</script>

<header
	class="sticky top-0 z-50 border-b border-[var(--color-border)] bg-white/95 backdrop-blur-sm"
>
	<div class="flex h-16 items-center justify-between px-6">
		<!-- Logo -->
		<div class="flex items-center gap-3">
			<a href="/" class="flex items-center gap-3">
				<div
					class="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--color-navy)] text-white"
				>
					<svg
						class="h-5 w-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 2L2 7l10 5 10-5-10-5z" />
						<path d="M2 17l10 5 10-5" />
						<path d="M2 12l10 5 10-5" />
					</svg>
				</div>
				<div>
					<span class="text-lg font-semibold text-[var(--color-navy)]">Clad Dashboard</span>
					<span
						class="ml-2 rounded bg-[var(--color-cream)] px-1.5 py-0.5 text-xs text-[var(--color-slate)]"
					>
						Beta
					</span>
				</div>
			</a>
		</div>

		<!-- Navigation -->
		<nav class="hidden items-center gap-6 md:flex">
			<a
				href="/"
				class="text-sm font-medium text-[var(--color-slate)] transition-colors hover:text-[var(--color-navy)]"
			>
				Overview
			</a>
			<a
				href="/balances"
				class="text-sm font-medium text-[var(--color-slate)] transition-colors hover:text-[var(--color-navy)]"
			>
				Balances
			</a>
			<a
				href="/whitelist"
				class="text-sm font-medium text-[var(--color-slate)] transition-colors hover:text-[var(--color-navy)]"
			>
				Whitelist
			</a>
			<a
				href="/events"
				class="text-sm font-medium text-[var(--color-slate)] transition-colors hover:text-[var(--color-navy)]"
			>
				Events
			</a>
		</nav>

		<!-- Connection Status -->
		<div class="flex items-center gap-4">
			<div class="flex items-center gap-2">
				<div class={`status-dot ${statusColors[connectionState]}`}></div>
				<span class="text-sm text-[var(--color-slate)]">
					{statusLabels[connectionState]}
				</span>
			</div>
		</div>
	</div>
</header>
