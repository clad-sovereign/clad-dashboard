<script lang="ts">
	import './layout.css';
	import { onMount, onDestroy } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { Header, Sidebar } from '$lib/components';
	import { connect, disconnect } from '$lib/substrate';

	let { children } = $props();

	onMount(async () => {
		// Establish connection to the Substrate node on app load
		try {
			await connect();
		} catch (error) {
			console.error('Failed to connect to node:', error);
		}
	});

	onDestroy(async () => {
		await disconnect();
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
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
