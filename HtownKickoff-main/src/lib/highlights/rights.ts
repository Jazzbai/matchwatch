import type { MatchSource, RightsStatus } from './types';

// Automated rights / compliance gate (workflow doc step 9). A missing or uncertain
// permission is never treated as approval: such assets are held, with the reason recorded.

export type RightsPolicy = { licensedIndexIds: string[]; licensedHls: boolean; indexId: string };

export function rightsPolicyFromEnv(): RightsPolicy {
  return {
    licensedIndexIds: (process.env.HIGHLIGHTS_LICENSED_INDEX_IDS || '').split(',').map(id => id.trim()).filter(Boolean),
    licensedHls: process.env.HIGHLIGHTS_LICENSED_HLS === 'true',
    indexId: process.env.TWELVELABS_INDEX_ID || '',
  };
}

export function assetRights(source: MatchSource, rightsDeclared: boolean, policy: RightsPolicy): { status: RightsStatus; reason: string } {
  if (source.kind === 'upload') {
    return rightsDeclared
      ? { status: 'permitted', reason: 'The uploader confirmed they hold the rights to this footage.' }
      : { status: 'pending_verification', reason: 'The uploader has not confirmed usage rights.' };
  }
  if (source.kind === 'library') {
    return policy.licensedIndexIds.includes(policy.indexId)
      ? { status: 'permitted', reason: 'This library is licensed for highlight use on this server.' }
      : { status: 'pending_verification', reason: 'No usage rights are recorded for this library asset.' };
  }
  return policy.licensedHls
    ? { status: 'permitted', reason: 'The live feed is licensed for highlight use on this server.' }
    : { status: 'pending_verification', reason: 'No usage rights are recorded for this live feed.' };
}
