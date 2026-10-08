import { createId } from '../../id-generator';
import { MonthKey } from './month.utils';
import { InstallmentInfo, TransactionKind, WalletEntry } from '../models/wallet.models';

export interface NewEntryData {
  kind: TransactionKind;
  description: string;
  value: number;
  month: MonthKey;
  installment?: InstallmentInfo;
}

export function createEntry(data: NewEntryData, now: Date = new Date()): WalletEntry {
  const base = {
    id: createId(),
    description: data.description,
    value: data.value,
    month: data.month,
    createdAt: now.toISOString(),
  };

  switch (data.kind) {
    case 'income':
      return { ...base, kind: 'income' };
    case 'saving':
      return { ...base, kind: 'saving' };
    case 'fixed-expense':
      return { ...base, kind: 'fixed-expense', paidMonths: {} };
    case 'variable-expense':
      return { ...base, kind: 'variable-expense', paid: false, installment: data.installment };
    default:
      assertNever(data.kind);
  }
}

export function isEntryPaidInMonth(entry: WalletEntry, month: MonthKey): boolean {
  switch (entry.kind) {
    case 'fixed-expense':
      return Boolean(entry.paidMonths[month]);
    case 'variable-expense':
      return entry.paid;
    default:
      return false;
  }
}

export function assertNever(valeu: never): never {
  throw new Error(`Tipo de lançamento não tratado: ${String(valeu)}`);
}
