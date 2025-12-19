<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { Header, Sidebar } from '$lib/components';

	let { children } = $props();
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
