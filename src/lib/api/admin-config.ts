/**
 * Admin Config endpoint functions
 *
 * Provides access to the admin multi-sig configuration including
 * signatories, threshold, and derived multi-sig address.
 */

import { get, isMockMode } from './client';
import { mockGetAdminConfig } from './mock';
import type { AdminMultisigConfig, ApiResult } from './types';

const BASE_PATH = '/api/v1/admin/config';

/**
 * Get the admin multi-sig configuration
 *
 * Returns the current admin multi-sig configuration including the derived
 * multi-sig address, list of signatories, and approval threshold.
 *
 * @returns Admin multi-sig config, or not_found error if not configured
 */
export async function getAdminConfig(): Promise<ApiResult<AdminMultisigConfig>> {
	if (isMockMode()) {
		return mockGetAdminConfig();
	}
	return get<AdminMultisigConfig>(BASE_PATH);
}
