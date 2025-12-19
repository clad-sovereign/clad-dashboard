/**
 * Type augmentations for @polkadot/api
 *
 * Provides compile-time type safety for chain-specific storage queries.
 * TypeScript will error if you query a storage item that doesn't exist
 * (e.g., api.query.cladToken.isFrozen instead of .frozen).
 *
 * When pallet storage changes, update the type definitions in cladToken.ts.
 */

import './cladToken';
