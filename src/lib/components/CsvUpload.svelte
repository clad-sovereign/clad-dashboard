<script lang="ts">
	import { parseAddressCsv, formatFileSize, type CsvParseResult } from '$lib/utils';

	interface Props {
		/** Called when a file is parsed */
		onParsed: (result: CsvParseResult, fileName: string) => void;
		/** Set of addresses already on the whitelist (for duplicate detection) */
		existingWhitelist?: Set<string>;
		/** Whether the upload is disabled */
		disabled?: boolean;
	}

	let { onParsed, existingWhitelist, disabled = false }: Props = $props();

	let isDragging = $state(false);
	let error = $state<string | null>(null);
	let isProcessing = $state(false);

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) {
			isDragging = true;
		}
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		if (disabled) return;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			processFile(files[0]);
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		const files = input.files;
		if (files && files.length > 0) {
			processFile(files[0]);
		}
		// Reset input so same file can be selected again
		input.value = '';
	}

	async function processFile(file: File) {
		error = null;

		// Validate file type
		if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
			error = 'Please upload a CSV or TXT file';
			return;
		}

		// Validate file size (max 1MB)
		const maxSize = 1024 * 1024;
		if (file.size > maxSize) {
			error = `File too large (${formatFileSize(file.size)}). Maximum size is 1 MB.`;
			return;
		}

		isProcessing = true;

		try {
			const content = await file.text();
			const result = parseAddressCsv(content, existingWhitelist);

			if (result.entries.length === 0) {
				error = 'No valid addresses found in file';
				return;
			}

			onParsed(result, file.name);
		} catch (e) {
			console.error('Failed to parse CSV:', e);
			error = e instanceof Error ? e.message : 'Failed to parse file';
		} finally {
			isProcessing = false;
		}
	}
</script>

<div
	class="relative rounded-lg border-2 border-dashed transition-colors {isDragging
		? 'border-[var(--color-teal)] bg-[var(--color-teal)]/5'
		: 'border-[var(--color-border)] hover:border-[var(--color-slate-light)]'} {disabled
		? 'cursor-not-allowed opacity-50'
		: 'cursor-pointer'}"
	role="button"
	tabindex={disabled ? -1 : 0}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
	onkeydown={(e) => {
		if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
			e.preventDefault();
			document.getElementById('csv-file-input')?.click();
		}
	}}
>
	<input
		type="file"
		id="csv-file-input"
		accept=".csv,.txt"
		class="absolute inset-0 cursor-pointer opacity-0 {disabled ? 'pointer-events-none' : ''}"
		onchange={handleFileSelect}
		{disabled}
	/>

	<div class="flex flex-col items-center justify-center px-6 py-10">
		{#if isProcessing}
			<svg class="h-12 w-12 animate-spin text-[var(--color-teal)]" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			<p class="mt-4 text-sm text-[var(--color-slate)]">Processing file...</p>
		{:else}
			<svg
				class="h-12 w-12 text-[var(--color-slate-light)]"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="1.5"
					d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
				/>
			</svg>
			<p class="mt-4 text-sm font-medium text-[var(--color-navy)]">
				{#if isDragging}
					Drop file to upload
				{:else}
					Drag and drop a CSV file, or click to browse
				{/if}
			</p>
			<p class="mt-1 text-xs text-[var(--color-slate-light)]">
				CSV or TXT file with one address per line (max 1 MB)
			</p>
		{/if}
	</div>
</div>

{#if error}
	<div class="mt-3 rounded-md bg-[var(--color-error-muted)] p-3 text-sm text-[#991b1b]">
		<div class="flex items-center gap-2">
			<svg class="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				/>
			</svg>
			{error}
		</div>
	</div>
{/if}
