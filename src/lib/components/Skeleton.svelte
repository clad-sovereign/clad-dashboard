<script lang="ts">
	/**
	 * Skeleton loading component for placeholder content.
	 * Uses a subtle pulse animation to indicate loading state.
	 */

	interface Props {
		/** Width class (e.g., 'w-24', 'w-full') */
		width?: string;
		/** Height class (e.g., 'h-4', 'h-8') */
		height?: string;
		/** Whether to render as a circle */
		circle?: boolean;
		/** Additional CSS classes */
		class?: string;
	}

	let { width = 'w-full', height = 'h-4', circle = false, class: className = '' }: Props = $props();
</script>

<div
	class="animate-pulse rounded bg-[var(--color-border)] {circle
		? 'rounded-full'
		: ''} {width} {height} {className}"
	role="status"
	aria-label="Loading..."
></div>
