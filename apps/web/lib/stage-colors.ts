import type { StageGroupKey } from './data/queries';

/** Sequential green ramp: lighter = earlier in the season. */
export const STAGE_COLORS: Record<StageGroupKey, string> = {
  sowing: '#eef7f0',
  transplanting: '#ddf0e2',
  vegetative: '#c2e4cb',
  rogueing: '#a2d3b0',
  pollination: '#7fbf93',
  maturity: '#5aa674',
  yield: '#2f7d4e',
  harvest: '#22673f',
  collection: '#165131',
  closed: '#0b3a22',
};

/** Text colour that passes contrast on each ramp step. */
export function stageTextColor(group: StageGroupKey): string {
  return ['yield', 'harvest', 'collection', 'closed'].includes(group) ? '#ffffff' : '#10201a';
}

export const CROP_COLORS: Record<string, string> = {
  HP: '#b5523b', TO: '#e39a3b', OK: '#3f8f5a', SC: '#e8c547', CU: '#4c86b8', WM: '#7e5ba6',
  CA: '#c4426a', BG: '#5f7f2a', RG: '#8a6d3b', SG: '#3b8a85', ON: '#9b6bb5',
};
