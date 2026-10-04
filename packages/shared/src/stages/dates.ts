/** Dates are ISO calendar dates (YYYY-MM-DD), compared in UTC to avoid timezone drift. */
export type IsoDate = string;

export function toUtcDay(date: IsoDate | Date): number {
  const d = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T00:00:00Z`) : date;
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 86_400_000);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date((toUtcDay(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toUtcDay(to) - toUtcDay(from);
}

export function todayIso(now = new Date()): IsoDate {
  return now.toISOString().slice(0, 10);
}
