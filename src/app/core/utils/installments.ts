import { NewEntryData } from './entry.utils';
import { addMonths, MonthKey } from './month.utils';

export function splitIntoInstallments(total: number, count: number): number[] {
  const totalCents = Math.round(total * 100);
  const basecents = Math.floor(totalCents / count);
  const remainderCents = totalCents - basecents * count;

  return Array.from({ length: count }, (_, index) => {
    const extraCent = index < remainderCents ? 1 : 0;
    return (basecents + extraCent) / 100;
  });
}

export interface InstallmentPlan {
  description: string;
  total: number;
  count: number;
  startMonth: MonthKey;
  groupId: string;
}

export function buildInstallments(plan: InstallmentPlan): NewEntryData[] {
  const values = splitIntoInstallments(plan.total, plan.count);
  const isInstallment = plan.count > 1;

  return values.map((value, index) => ({
    kind: 'variable-expense',
    description: isInstallment
      ? `${plan.description} Parc.:${index + 1}/${plan.count}`
      : plan.description,
    value,
    month: addMonths(plan.startMonth, index),
    installment: isInstallment
      ? { groupId: plan.groupId, current: index + 1, total: plan.count }
      : undefined,
  }));
}

export function stripInstallmentSuffix(description: string): string {
  return description.replace(/\s+Parc\.:\d+\/\d+$/i, '');
}
