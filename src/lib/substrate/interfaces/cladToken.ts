/**
 * Type augmentations for cladToken pallet
 *
 * This provides compile-time type safety for cladToken storage queries.
 * The type definitions match the storage items in pallet-clad-token.
 *
 * To regenerate these types when the pallet changes:
 * 1. Run the node: ./target/release/clad-node --dev
 * 2. Inspect metadata via Polkadot.js Apps or polkadot-types-chain-info
 * 3. Update the types below to match
 */

import '@polkadot/api-base/types/storage';

import type { ApiTypes, AugmentedQuery, QueryableStorageEntry } from '@polkadot/api-base/types';
import type { Option, bool, u128 } from '@polkadot/types-codec';
import type { AccountId32 } from '@polkadot/types/interfaces/runtime';
import type { Observable } from '@polkadot/types/types';

declare module '@polkadot/api-base/types/storage' {
	interface AugmentedQueries<ApiType extends ApiTypes> {
		cladToken: {
			/**
			 * The current admin account for privileged operations.
			 * Storage: StorageValue<AccountId>
			 **/
			admin: AugmentedQuery<ApiType, () => Observable<Option<AccountId32>>, []> &
				QueryableStorageEntry<ApiType, []>;

			/**
			 * Token balance for each account.
			 * Storage: StorageMap<AccountId, u128>
			 **/
			balances: AugmentedQuery<
				ApiType,
				(arg: AccountId32 | string | Uint8Array) => Observable<u128>,
				[AccountId32]
			> &
				QueryableStorageEntry<ApiType, [AccountId32]>;

			/**
			 * Accounts that are frozen and cannot send transfers.
			 * Storage: StorageMap<AccountId, bool>
			 **/
			frozen: AugmentedQuery<
				ApiType,
				(arg: AccountId32 | string | Uint8Array) => Observable<bool>,
				[AccountId32]
			> &
				QueryableStorageEntry<ApiType, [AccountId32]>;

			/**
			 * Multi-sig threshold required for admin operations.
			 * Storage: StorageValue<u32>
			 **/
			multisigThreshold: AugmentedQuery<ApiType, () => Observable<u128>, []> &
				QueryableStorageEntry<ApiType, []>;

			/**
			 * Total supply of CLAD tokens.
			 * Storage: StorageValue<u128>
			 **/
			totalSupply: AugmentedQuery<ApiType, () => Observable<u128>, []> &
				QueryableStorageEntry<ApiType, []>;

			/**
			 * KYC whitelist - accounts approved for transfers.
			 * Storage: StorageMap<AccountId, bool>
			 **/
			whitelist: AugmentedQuery<
				ApiType,
				(arg: AccountId32 | string | Uint8Array) => Observable<bool>,
				[AccountId32]
			> &
				QueryableStorageEntry<ApiType, [AccountId32]>;
		};
	}
}
