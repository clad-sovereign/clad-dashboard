<script lang="ts">
	/**
	 * Card skeleton for loading states in card-based layouts.
	 */
	import Skeleton from './Skeleton.svelte';

	interface Props {
		/** Number of cards to show */
		count?: number;
		/** Whether to show a progress bar skeleton */
		showProgress?: boolean;
	}

	let { count = 3, showProgress = true }: Props = $props();

	// Create arrays for iteration
	const cardIndices = $derived(Array.from({ length: count }, (_, i) => i));
	const detailIndices = [0, 1, 2];
</script>

<div class="space-y-4">
	{#each cardIndices as cardIdx (cardIdx)}
		<div class="card">
			<!-- Header -->
			<div class="flex items-start justify-between">
				<div class="flex items-start gap-3">
					<Skeleton width="w-10" height="h-10" circle />
					<div class="space-y-2">
						<Skeleton width="w-32" height="h-5" />
						<Skeleton width="w-48" height="h-4" />
					</div>
				</div>
				<div class="space-y-1 text-right">
					<Skeleton width="w-20" height="h-4" />
					<Skeleton width="w-16" height="h-3" />
				</div>
			</div>

			<!-- Progress bar -->
			{#if showProgress}
				<div class="mt-4">
					<Skeleton width="w-full" height="h-2" />
				</div>
			{/if}

			<!-- Details grid -->
			<div class="mt-4 grid gap-4 md:grid-cols-3">
				{#each detailIndices as detailIdx (detailIdx)}
					<div class="space-y-1">
						<Skeleton width="w-20" height="h-3" />
						<Skeleton width="w-28" height="h-4" />
					</div>
				{/each}
			</div>

			<!-- Footer -->
			<div class="mt-4 border-t border-[var(--color-border)] pt-4">
				<div class="flex items-center justify-between">
					<div class="space-y-1">
						<Skeleton width="w-16" height="h-3" />
						<Skeleton width="w-48" height="h-4" />
					</div>
					<div class="space-y-1 text-right">
						<Skeleton width="w-12" height="h-3" />
						<Skeleton width="w-20" height="h-4" />
					</div>
				</div>
			</div>
		</div>
	{/each}
</div>
