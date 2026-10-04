import { formatArea, SQM_PER_ACRE } from '@nk/shared';

const int = new Intl.NumberFormat('en-IN');
const one = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fmtInt = (n: number) => int.format(Math.round(n));
export const fmtOne = (n: number) => one.format(n);
export const fmtAcres = (sqm: number) => `${fmtInt(sqm / SQM_PER_ACRE)} ac`;
export const fmtAcresPrecise = (sqm: number) => `${(sqm / SQM_PER_ACRE).toFixed(2)} ac`;
export const fmtGuntas = (sqm: number) => formatArea(sqm, 'GUNTA');
export const fmtTonnes = (kg: number) => one.format(kg / 1000);
export const fmtPct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;
export const fmtSignedPct = (v: number, digits = 1) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(digits)}%`;

/** "02 Oct" from an ISO date or timestamp. */
export function fmtDay(iso: string): string {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;
}

/** "02 Oct, 16:12" in IST. */
export function fmtDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function fmtDays(n: number): string {
  return `${n} ${Math.abs(n) === 1 ? 'day' : 'days'}`;
}

export function maskMobile(m: string): string {
  return `${m.slice(0, 2)}•••••${m.slice(-3)}`;
}

export function initials(name: string): string {
  return name.replace(/[^A-Za-z ]/g, ' ').split(' ').filter(Boolean).map((p) => p[0]).join('').slice(-2).toUpperCase();
}
