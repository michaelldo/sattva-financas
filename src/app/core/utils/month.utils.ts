export type MonthKey = string;

export function toMonthKey(date: Date): MonthKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`;
}

export function monthKeyToDate(month: MonthKey): Date {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Number(year), monthNumber - 1, 1);
}

export function getCurrentMonth(now: Date = new Date()): MonthKey {
  return toMonthKey(now);
}

export function addMonths(month: MonthKey, offset: number): MonthKey {
  const date = monthKeyToDate(month);
  return toMonthKey(new Date(date.getFullYear(), date.getMonth() + offset, 1));
}
