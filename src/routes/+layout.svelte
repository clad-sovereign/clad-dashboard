<script lang="ts">
	import './layout.css';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Header, Sidebar } from '$lib/components';
	import { connect, disconnect } from '$lib/substrate';

	const STORAGE_KEY = 'clad-dashboard-endpoint';
	const DEFAULT_ENDPOINT = 'ws://127.0.0.1:9944';

	let { children } = $props();

	onMount(async () => {
		// Load saved endpoint from localStorage or use default
		let endpoint = DEFAULT_ENDPOINT;
		if (browser) {
			const stored = localStorage.getItem(STORAGE_KEY);
			if (stored) {
				endpoint = stored;
			}
		}

		// Establish connection to the Substrate node on app load
		try {
			await connect(endpoint);
		} catch (error) {
			console.error('Failed to connect to node:', error);
		}
	});

	onDestroy(async () => {
		await disconnect();
	});
</script>

<svelte:head>
	<title>Clad Dashboard</title>
</svelte:head>

<div class="flex min-h-screen flex-col">
	<Header />
	<div class="flex flex-1">
		<Sidebar />
		<main class="flex-1 overflow-auto p-6">
			{@render children()}
		</main>
	</div>
</div>
