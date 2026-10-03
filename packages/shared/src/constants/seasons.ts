export const SEASONS = [
  { code: '01', name: 'Kharif', startMonth: 6, endMonth: 10 },
  { code: '02', name: 'Rabi', startMonth: 10, endMonth: 3 },
  // Reserved pending a business decision (SPECS §9, Q2).
  { code: '03', name: 'Summer', startMonth: 2, endMonth: 6 },
] as const;

export type SeasonCode = (typeof SEASONS)[number]['code'];

export function seasonName(code: string): string {
  return SEASONS.find((s) => s.code === code)?.name ?? code;
}
