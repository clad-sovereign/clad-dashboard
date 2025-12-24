<script lang="ts">
	import type { BatchResult } from '$lib/services';

	interface Props {
		/** Current progress (0 to total) */
		current: number;
		/** Total items to process */
		total: number;
		/** Current address being processed */
		currentAddress?: string;
		/** Final result (when complete) */
		result?: BatchResult;
		/** Called when user dismisses the result */
		onDismiss?: () => void;
	}

	let { current, total, currentAddress, result, onDismiss }: Props = $props();

	// Calculate percentage
	let percentage = $derived(total > 0 ? Math.round((current / total) * 100) : 0);

	// Format elapsed time
	function formatElapsed(ms: number): string {
		if (ms < 1000) return `${ms}ms`;
		if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		return `${minutes}m ${seconds}s`;
	}
</script>

{#if result}
	<!-- Completed state -->
	<div class="card">
		<div class="flex items-start gap-4">
			{#if result.failureCount === 0}
				<!-- All successful -->
				<div
					class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-success-muted)]"
				>
					<svg
						class="h-6 w-6 text-[var(--color-success)]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						/>
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="font-medium text-[var(--color-success)]">Proposals Created Successfully</h3>
					<p class="mt-1 text-sm text-[var(--color-slate)]">
						{result.successCount} whitelist proposal{result.successCount !== 1 ? 's' : ''} created in
						{formatElapsed(result.elapsedMs)}
					</p>
				</div>
			{:else if result.successCount === 0}
				<!-- All failed -->
				<div
					class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-error-muted)]"
				>
					<svg
						class="h-6 w-6 text-[var(--color-error)]"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</div>
				<div class="flex-1">
					<h3 class="font-medium text-[var(--color-error)]">Failed to Create Proposals</h3>
					<p class="mt-1 text-sm text-[var(--color-slate)]">
						All {result.failureCount} proposal{result.failureCount !== 1 ? 's' : ''} failed. Check server
						connection.
					</p>
				</div>
			{:else}
				<!-- Partial success -->
				<div
					class="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[var(--color-warning-muted)]"
				>
					<svg
						class="h-6 w-6 text-[var(--color-warning)]"
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
				</div>
				<div class="flex-1">
					<h3 class="font-medium text-[var(--color-warning)]">Partially Completed</h3>
					<p class="mt-1 text-sm text-[var(--color-slate)]">
						{result.successCount} of {result.successCount + result.failureCount} proposals created.
						{result.failureCount} failed.
					</p>
				</div>
			{/if}
			{#if onDismiss}
				<button type="button" class="btn btn-secondary text-sm" onclick={onDismiss}> Done </button>
			{/if}
		</div>

		<!-- Show failed addresses if any -->
		{#if result.failureCount > 0}
			<div class="mt-4 border-t border-[var(--color-border)] pt-4">
				<h4 class="text-sm font-medium text-[var(--color-slate)]">Failed Addresses</h4>
				<div class="mt-2 max-h-32 overflow-y-auto">
					{#each result.results.filter((r) => !r.success) as failed (failed.address)}
						<div class="flex items-center justify-between py-1 text-sm">
							<code class="font-mono text-[var(--color-navy)]">
								{failed.address.slice(0, 8)}...{failed.address.slice(-6)}
							</code>
							<span class="text-[var(--color-error)]">{failed.error}</span>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</div>
{:else}
	<!-- In progress state -->
	<div class="card">
		<div class="flex items-center gap-4">
			<div class="flex-shrink-0">
				<svg class="h-8 w-8 animate-spin text-[var(--color-teal)]" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
					></circle>
					<path
						class="opacity-75"
						fill="currentColor"
						d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
					></path>
				</svg>
			</div>
			<div class="flex-1">
				<div class="flex items-center justify-between">
					<h3 class="font-medium text-[var(--color-navy)]">Creating Proposals</h3>
					<span class="text-sm text-[var(--color-slate)]">{current} of {total}</span>
				</div>

				<!-- Progress bar -->
				<div class="mt-2 h-2 w-full rounded-full bg-[var(--color-cream)]">
					<div
						class="h-2 rounded-full bg-[var(--color-teal)] transition-all duration-300"
						style="width: {percentage}%"
					></div>
				</div>

				{#if currentAddress}
					<p class="mt-2 text-xs text-[var(--color-slate-light)]">
						Processing: <code class="font-mono"
							>{currentAddress.slice(0, 8)}...{currentAddress.slice(-6)}</code
						>
					</p>
				{/if}
			</div>
		</div>
	</div>
{/if}
