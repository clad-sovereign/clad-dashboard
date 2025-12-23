<script lang="ts">
	/**
	 * Table skeleton for loading states in list/table views.
	 */
	import Skeleton from './Skeleton.svelte';

	interface Props {
		/** Number of rows to show */
		rows?: number;
		/** Number of columns */
		columns?: number;
		/** Whether to show a header row */
		showHeader?: boolean;
	}

	let { rows = 5, columns = 4, showHeader = true }: Props = $props();

	// Create arrays for iteration
	const rowIndices = $derived(Array.from({ length: rows }, (_, i) => i));
	const colIndices = $derived(Array.from({ length: columns }, (_, i) => i));
</script>

<div class="card overflow-hidden p-0">
	<table class="w-full">
		{#if showHeader}
			<thead>
				<tr class="border-b border-[var(--color-border)] bg-[var(--color-cream)]">
					{#each colIndices as colIdx (colIdx)}
						<th class="px-4 py-3">
							<Skeleton width="w-16" height="h-3" />
						</th>
					{/each}
				</tr>
			</thead>
		{/if}
		<tbody class="divide-y divide-[var(--color-border)]">
			{#each rowIndices as rowIdx (rowIdx)}
				<tr>
					{#each colIndices as colIdx (colIdx)}
						<td class="px-4 py-3">
							<Skeleton
								width={colIdx === 0 ? 'w-20' : colIdx === columns - 1 ? 'w-16' : 'w-24'}
								height="h-4"
							/>
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>
