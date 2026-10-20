export type MonthKey = string;
const MONTH_KEY_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export function toMonthKey(date: Date): MonthKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
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

export function formatMonthLabel(month: MonthKey): string {
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(
    monthKeyToDate(month),
  );
}

export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const months: MonthKey[] = [];
  for (let month = from; month <= to; month = addMonths(month, 1)) {
    months.push(month);
  }
  return months;
}

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && MONTH_KEY_PATTERN.test(value);
}
