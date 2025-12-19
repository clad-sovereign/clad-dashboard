<script lang="ts">
	import { subscribeToConnectionState, type ConnectionState } from '$lib/substrate';
	import { onMount, onDestroy } from 'svelte';
	import StatusDot from './StatusDot.svelte';

	interface Props {
		onMenuToggle: () => void;
		mobileMenuOpen: boolean;
	}

	let { onMenuToggle, mobileMenuOpen }: Props = $props();

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
		<!-- Left section: Mobile menu button + Logo -->
		<div class="flex items-center gap-2">
			<!-- Mobile menu button -->
			<button
				type="button"
				onclick={onMenuToggle}
				class="rounded-lg p-2 text-[var(--color-slate)] transition-colors hover:bg-[var(--color-cream)] hover:text-[var(--color-navy)] lg:hidden"
				aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={mobileMenuOpen}
			>
				<svg
					class="h-6 w-6 transition-transform duration-200 {mobileMenuOpen ? 'rotate-90' : ''}"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					{#if mobileMenuOpen}
						<path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
					{:else}
						<path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
					{/if}
				</svg>
			</button>

			<!-- Logo -->
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
						class="ml-2 hidden rounded bg-[var(--color-cream)] px-1.5 py-0.5 text-xs text-[var(--color-slate)] sm:inline"
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
				<StatusDot status={connectionState} />
				<span class="text-sm text-[var(--color-slate)]">
					{statusLabels[connectionState]}
				</span>
			</div>
		</div>
	</div>
</header>
