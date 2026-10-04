export type PollinationMethod = 'HAND_EMASCULATION' | 'HAND_POLLINATION_ONLY' | 'DETASSELING' | 'BULB_CROSSING';

export interface Crop {
  code: string;
  name: string;
  isTransplanted: boolean;
  pollinationMethod: PollinationMethod;
  /** Stage flow still needs business confirmation. */
  flowPending?: boolean;
}

export const CROPS: readonly Crop[] = [
  { code: 'HP', name: 'Hot Pepper', isTransplanted: true, pollinationMethod: 'HAND_EMASCULATION' },
  { code: 'OK', name: 'Okra', isTransplanted: false, pollinationMethod: 'HAND_EMASCULATION' },
  { code: 'TO', name: 'Tomato', isTransplanted: true, pollinationMethod: 'HAND_EMASCULATION' },
  { code: 'WM', name: 'Water Melon', isTransplanted: false, pollinationMethod: 'HAND_POLLINATION_ONLY' },
  { code: 'CU', name: 'Cucumber', isTransplanted: false, pollinationMethod: 'HAND_POLLINATION_ONLY' },
  { code: 'BG', name: 'Bitter Gourd', isTransplanted: false, pollinationMethod: 'HAND_POLLINATION_ONLY' },
  { code: 'RG', name: 'Ridge Gourd', isTransplanted: false, pollinationMethod: 'HAND_POLLINATION_ONLY' },
  { code: 'SG', name: 'Snake Gourd', isTransplanted: false, pollinationMethod: 'HAND_POLLINATION_ONLY' },
  { code: 'ON', name: 'Onion', isTransplanted: false, pollinationMethod: 'BULB_CROSSING', flowPending: true },
  { code: 'CA', name: 'Capsicum', isTransplanted: true, pollinationMethod: 'HAND_EMASCULATION' },
  { code: 'SC', name: 'Sweet Corn', isTransplanted: false, pollinationMethod: 'DETASSELING' },
];

export function getCrop(code: string): Crop | undefined {
  return CROPS.find((c) => c.code === code);
}

export const POLLINATION_LABELS: Record<PollinationMethod, string> = {
  HAND_EMASCULATION: 'Hand emasculation',
  HAND_POLLINATION_ONLY: 'Hand pollination',
  DETASSELING: 'Detasseling',
  BULB_CROSSING: 'Bulb crossing',
};
