import { NewEntryData, sumValues } from './entry.utils';
import { addMonths, MonthKey } from './month.utils';
import { TransactionKind, VariableExpenseEntry, WalletEntry } from '../models/wallet.models';

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
    kind: TransactionKind.VariableExpense,
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

export function remainingAfterInstallment(entries: readonly WalletEntry[]): Map<string, number> {
  const groups = new Map<string, VariableExpenseEntry[]>();

  for (const entry of entries) {
    if (entry.kind === TransactionKind.VariableExpense && entry.installment) {
      const group = groups.get(entry.installment.groupId) ?? [];
      group.push(entry);
      groups.set(entry.installment.groupId, group);
    }
  }

  const remaining = new Map<string, number>();

  for (const group of groups.values()) {
    for (const entry of group) {
      const later = group.filter(
        (other) => other.installment!.current > entry.installment!.current,
      );
      remaining.set(entry.id, sumValues(later));
    }
  }

  return remaining;
}
