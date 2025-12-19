/**
 * Known multisig account configurations
 *
 * This file defines the multisig accounts that the dashboard can display
 * detailed information for (threshold, signatories).
 *
 * Why config-based?
 * - The chain's multisig.multisigs storage only stores { when, deposit, depositor, approvals }
 * - Threshold and signatories are NOT stored (address is derived from them)
 * - For pilots, ministry provides these details during onboarding
 *
 * Production roadmap:
 * - Phase 1 (Pilots): Config file per deployment
 * - Phase 2: Indexer service to discover multisig configurations
 * - Phase 3: On-chain governance pallet with stored metadata
 */

export interface SignatoryInfo {
	/** SS58 address of the signatory */
	address: string;
	/** Optional friendly name (e.g., "Alice", "Treasury Officer") */
	name?: string;
}

export interface MultisigConfig {
	/** SS58 address of the multisig account */
	address: string;
	/** Human-readable name for this multisig */
	name: string;
	/** Number of approvals required */
	threshold: number;
	/** List of all signatories */
	signatories: SignatoryInfo[];
}

/**
 * Known multisig accounts
 *
 * Add your multisig accounts here. The address must match exactly
 * (it's derived from sorted signatories + threshold).
 *
 * To derive a multisig address:
 * 1. Sort signatories alphabetically by their raw bytes
 * 2. Compute: blake2_256("modlpy/utilisuba" ++ compact(len) ++ signatories ++ threshold_u16_le)
 * 3. Encode as SS58
 *
 * Or use: https://polkadot.js.org/apps/#/accounts → Add Multisig
 */
export const KNOWN_MULTISIG_ACCOUNTS: MultisigConfig[] = [
	// Development accounts (Alice, Bob, Charlie 2-of-3)
	{
		address: '5DjYJStmdZ2rcqXbXGX7TW85JsrW6uG4y9MUcLq2BoPMpRA7',
		name: 'Token Admin (Dev)',
		threshold: 2,
		signatories: [
			{ address: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY', name: 'Alice' },
			{ address: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty', name: 'Bob' },
			{ address: '5FLSigC9HGRKVhB9FiEo4Y3koPsNmBmLJbpXg2mp1hXcS59Y', name: 'Charlie' }
		]
	}
	// Add more multisig accounts as needed for your deployment
	// {
	//   address: '5...',
	//   name: 'Ministry Treasury',
	//   threshold: 3,
	//   signatories: [
	//     { address: '5...', name: 'Finance Officer' },
	//     { address: '5...', name: 'Compliance Officer' },
	//     { address: '5...', name: 'Director' },
	//     { address: '5...', name: 'Auditor' },
	//   ]
	// }
];

/**
 * Look up multisig configuration by address
 */
export function getMultisigConfig(address: string): MultisigConfig | undefined {
	return KNOWN_MULTISIG_ACCOUNTS.find((m) => m.address === address);
}

/**
 * Get signatory name if known, otherwise return truncated address
 */
export function getSignatoryDisplayName(
	address: string,
	config: MultisigConfig | undefined
): string | undefined {
	if (!config) return undefined;
	const signatory = config.signatories.find((s) => s.address === address);
	return signatory?.name;
}
