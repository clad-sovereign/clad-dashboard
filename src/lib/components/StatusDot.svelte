<script lang="ts">
	type Status = 'connected' | 'connecting' | 'disconnected' | 'error';

	interface Props {
		status: Status;
	}

	let { status }: Props = $props();

	const statusColors: Record<Status, string> = {
		connected: 'bg-[var(--color-success)]',
		connecting: 'bg-[var(--color-warning)]',
		disconnected: 'bg-[var(--color-error)]',
		error: 'bg-[var(--color-error)]'
	};
</script>

<span class="relative flex h-2 w-2">
	{#if status === 'connected'}
		<span
			class="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-success)] opacity-75"
		></span>
	{/if}
	<span class={`relative inline-flex h-2 w-2 rounded-full ${statusColors[status]}`}></span>
</span>
