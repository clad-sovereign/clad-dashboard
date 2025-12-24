<script lang="ts">
	import { page } from '$app/stores';
	import { fade } from 'svelte/transition';

	interface Props {
		mobileMenuOpen: boolean;
		onClose: () => void;
	}

	let { mobileMenuOpen, onClose }: Props = $props();

	const navItems = [
		{ href: '/', label: 'Overview', icon: 'home' },
		{ href: '/balances', label: 'Balances', icon: 'wallet' },
		{ href: '/whitelist', label: 'Whitelist', icon: 'users' },
		{ href: '/proposals', label: 'Proposals', icon: 'clipboard' },
		{ href: '/events', label: 'Events', icon: 'activity' },
		{ href: '/multisig', label: 'Multi-sig', icon: 'shield' },
		{ href: '/settings', label: 'Settings', icon: 'settings' }
	] as const;

	type IconName = (typeof navItems)[number]['icon'];

	const icons: Record<IconName, string> = {
		home: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
		wallet:
			'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
		users:
			'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
		clipboard:
			'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
		activity: 'M22 12h-4l-3 9L9 3l-3 9H2',
		shield:
			'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
		settings:
			'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z'
	};
</script>

<!-- Mobile overlay backdrop -->
{#if mobileMenuOpen}
	<button
		type="button"
		class="fixed inset-0 z-40 bg-black/50 lg:hidden"
		onclick={onClose}
		aria-label="Close menu"
		transition:fade={{ duration: 200 }}
	></button>
{/if}

<!-- Sidebar -->
<aside
	class="fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] w-64 flex-col border-r border-[var(--color-border)] bg-white transition-transform duration-200 ease-in-out lg:static lg:flex lg:h-auto lg:translate-x-0 {mobileMenuOpen
		? 'flex translate-x-0'
		: 'hidden'}"
>
	<nav class="flex-1 overflow-y-auto px-4 py-6">
		<ul class="space-y-1">
			{#each navItems as item (item.href)}
				{@const isActive = $page.url.pathname === item.href}
				<li>
					<a
						href={item.href}
						onclick={onClose}
						class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors {isActive
							? 'border-l-4 border-[var(--color-navy)] bg-[var(--color-cream)] text-[var(--color-navy)]'
							: 'border-l-4 border-transparent text-[var(--color-slate)] hover:bg-[var(--color-cream)] hover:text-[var(--color-navy)]'}"
					>
						<svg
							class="h-5 w-5"
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
							stroke-width="1.5"
						>
							<path stroke-linecap="round" stroke-linejoin="round" d={icons[item.icon]} />
						</svg>
						{item.label}
					</a>
				</li>
			{/each}
		</ul>
	</nav>

	<!-- Footer -->
	<div class="border-t border-[var(--color-border)] px-4 py-4">
		<div class="text-xs text-[var(--color-slate-light)]">
			<p>Clad Dashboard v0.1.0</p>
			<p class="mt-1">
				<a
					href="https://github.com/clad-sovereign/clad-dashboard"
					target="_blank"
					rel="noopener noreferrer"
					class="transition-colors hover:text-[var(--color-navy)]"
				>
					GitHub
				</a>
				<span class="mx-1">·</span>
				<a
					href="https://clad.so"
					target="_blank"
					rel="noopener noreferrer"
					class="transition-colors hover:text-[var(--color-navy)]"
				>
					Website
				</a>
			</p>
		</div>
	</div>
</aside>
