// Nigeria is UTC+1 all year, with no daylight saving
const OFFSET_MS = 60 * 60 * 1000;

// The current date (YYYY-MM-DD) and hour (0 to 24, with decimals) in Nigeria
export function lagosNow() {
  const d = new Date(Date.now() + OFFSET_MS);
  return {
    date: d.toISOString().slice(0, 10),
    hour: d.getUTCHours() + d.getUTCMinutes() / 60,
  };
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Rejects things like 2026-02-31
export function isRealDate(value: string): boolean {
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}