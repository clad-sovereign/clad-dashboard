<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Option } from '@polkadot/types-codec';
	import type { AccountId32 } from '@polkadot/types/interfaces/runtime';
	import {
		subscribeToConnectionState,
		getApiOrNull,
		type ConnectionState,
		type AdminStatus,
		type AdminType,
		formatAddress
	} from '$lib/substrate';
	import { getMultisigConfig } from '$lib/config/multisig-accounts';
	import StatusDot from './StatusDot.svelte';

	// Well-known dev accounts (from subkey inspect //Alice, //Bob, etc.)
	const DEV_ACCOUNTS: Record<string, string> = {
		'5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY': 'Alice',
		'5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty': 'Bob',
		'5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y': 'Charlie',
		'5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy': 'Dave',
		'5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw': 'Eve',
		'5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL': 'Ferdie'
	};

	let connectionState: ConnectionState = $state('disconnected');
	let adminStatus = $state<AdminStatus>({
		hasAdmin: false,
		address: null,
		type: 'unknown'
	});
	let isLoading = $state(false);

	let unsubscribeState: (() => void) | null = null;
	let unsubscribeAdmin: (() => void) | null = null;

	onMount(() => {
		unsubscribeState = subscribeToConnectionState(async (state) => {
			connectionState = state;

			if (state === 'connected') {
				await subscribeToAdmin();
			} else {
				// Clean up admin subscription when disconnected
				if (unsubscribeAdmin) {
					unsubscribeAdmin();
					unsubscribeAdmin = null;
				}
				adminStatus = {
					hasAdmin: false,
					address: null,
					type: 'unknown'
				};
			}
		});
	});

	onDestroy(() => {
		if (unsubscribeState) unsubscribeState();
		if (unsubscribeAdmin) unsubscribeAdmin();
	});

	/**
	 * Subscribe to admin storage changes for real-time updates
	 */
	async function subscribeToAdmin(): Promise<void> {
		const api = getApiOrNull();
		if (!api) return;

		// Clean up existing subscription
		if (unsubscribeAdmin) {
			unsubscribeAdmin();
			unsubscribeAdmin = null;
		}

		isLoading = true;

		try {
			// Subscribe to admin storage - callback fires on initial value and on every change
			const unsub = await api.query.cladToken?.admin?.((adminOption: Option<AccountId32>) => {
				updateAdminStatus(adminOption);
				isLoading = false;
			});

			if (unsub) {
				unsubscribeAdmin = unsub;
			}
		} catch (error) {
			console.error('Failed to subscribe to admin status:', error);
			adminStatus = {
				hasAdmin: false,
				address: null,
				type: 'unknown'
			};
			isLoading = false;
		}
	}

	/**
	 * Update admin status from storage value
	 */
	function updateAdminStatus(adminOption: Option<AccountId32> | undefined): void {
		if (!adminOption || adminOption.isNone) {
			adminStatus = {
				hasAdmin: false,
				address: null,
				type: 'unknown'
			};
			return;
		}

		const adminAddress = adminOption.unwrap().toString();

		// Check if it's a known multisig
		const multisigConfig = getMultisigConfig(adminAddress);

		if (multisigConfig) {
			adminStatus = {
				hasAdmin: true,
				address: adminAddress,
				type: 'multisig',
				multisigConfig: {
					name: multisigConfig.name,
					threshold: multisigConfig.threshold,
					signatories: multisigConfig.signatories.map((s) => ({
						address: s.address,
						name: s.name
					}))
				}
			};
			return;
		}

		// Check if it's a known dev account (root)
		const devName = DEV_ACCOUNTS[adminAddress];
		if (devName) {
			adminStatus = {
				hasAdmin: true,
				address: adminAddress,
				type: 'root'
			};
			return;
		}

		// Unknown account type
		adminStatus = {
			hasAdmin: true,
			address: adminAddress,
			type: 'unknown'
		};
	}

	function getAdminTypeLabel(type: AdminType): string {
		switch (type) {
			case 'root':
				return 'Root (Dev)';
			case 'multisig':
				return 'Multi-sig';
			case 'unknown':
				return 'Unknown';
		}
	}

	function getAdminTypeBadgeClass(type: AdminType): string {
		switch (type) {
			case 'root':
				return 'badge-warning';
			case 'multisig':
				return 'badge-success';
			case 'unknown':
				return 'badge-error';
		}
	}

	function getDevAccountName(address: string): string | null {
		return DEV_ACCOUNTS[address] ?? null;
	}

	// Derived for display
	let adminDisplayName = $derived.by(() => {
		if (!adminStatus.hasAdmin || !adminStatus.address) return '-';

		if (adminStatus.type === 'multisig' && adminStatus.multisigConfig) {
			return adminStatus.multisigConfig.name;
		}

		const devName = getDevAccountName(adminStatus.address);
		if (devName) return `${devName} (Dev)`;

		return formatAddress(adminStatus.address);
	});

	let showSignatories = $state(false);
</script>

<div class="card">
	<div class="flex items-center justify-between">
		<h3 class="text-sm font-medium text-[var(--color-slate-light)]">Admin Configuration</h3>
		{#if connectionState === 'connected' && adminStatus.hasAdmin}
			<span class="badge {getAdminTypeBadgeClass(adminStatus.type)}">
				{getAdminTypeLabel(adminStatus.type)}
			</span>
		{/if}
	</div>

	{#if connectionState !== 'connected'}
		<div class="mt-3 flex items-center gap-2 text-sm text-[var(--color-slate-light)]">
			<StatusDot status={connectionState} />
			<span>Waiting for connection...</span>
		</div>
	{:else if isLoading}
		<div class="mt-3 flex items-center gap-2">
			<svg class="h-4 w-4 animate-spin text-[var(--color-slate)]" viewBox="0 0 24 24" fill="none">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
			<span class="text-sm text-[var(--color-slate-light)]">Loading...</span>
		</div>
	{:else if !adminStatus.hasAdmin}
		<div class="mt-3">
			<p class="text-lg font-semibold text-[var(--color-error)]">No Admin Set</p>
			<p class="mt-1 text-xs text-[var(--color-text-muted)]">
				Admin account has not been configured
			</p>
		</div>
	{:else}
		<div class="mt-3 space-y-3">
			<!-- Admin Name/Account -->
			<div>
				<p class="text-lg font-semibold text-[var(--color-navy)]">{adminDisplayName}</p>
				{#if adminStatus.address}
					<p class="mt-0.5 font-mono text-xs text-[var(--color-text-muted)]">
						{formatAddress(adminStatus.address, 8)}
					</p>
				{/if}
			</div>

			<!-- Multi-sig Details -->
			{#if adminStatus.type === 'multisig' && adminStatus.multisigConfig}
				<div class="rounded-md bg-[var(--color-cream)] p-3">
					<div class="flex items-center justify-between">
						<span class="text-sm text-[var(--color-slate)]">Threshold</span>
						<span class="font-medium text-[var(--color-navy)]">
							{adminStatus.multisigConfig.threshold} of {adminStatus.multisigConfig.signatories
								.length}
						</span>
					</div>

					<div class="mt-3">
						<button
							type="button"
							class="flex w-full items-center justify-between text-sm text-[var(--color-slate)] hover:text-[var(--color-navy)]"
							onclick={() => (showSignatories = !showSignatories)}
						>
							<span>Signatories</span>
							<svg
								class="h-4 w-4 transition-transform {showSignatories ? 'rotate-180' : ''}"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</button>

						{#if showSignatories}
							<ul class="mt-2 space-y-1.5">
								{#each adminStatus.multisigConfig.signatories as signatory (signatory.address)}
									<li class="flex items-center justify-between text-xs">
										{#if signatory.name}
											<span class="font-medium text-[var(--color-navy)]">{signatory.name}</span>
										{/if}
										<span
											class="font-mono text-[var(--color-text-muted)] {signatory.name
												? ''
												: 'font-medium text-[var(--color-navy)]'}"
										>
											{formatAddress(signatory.address, 6)}
										</span>
									</li>
								{/each}
							</ul>
						{/if}
					</div>
				</div>
			{/if}

			<!-- Root/Dev Warning -->
			{#if adminStatus.type === 'root'}
				<div
					class="flex items-start gap-2 rounded-md border border-[var(--color-warning)] bg-[var(--color-warning-muted)] p-2"
				>
					<svg
						class="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-warning)]"
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
					<p class="text-xs text-[#92400e]">
						Dev mode: Using root account. Production should use multi-sig governance.
					</p>
				</div>
			{/if}
		</div>
	{/if}
</div>
