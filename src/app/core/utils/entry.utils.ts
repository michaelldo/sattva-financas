import { createId } from '../../id-generator';
import { MonthKey } from './month.utils';
import {
  EntriesByKind,
  InstallmentInfo,
  TransactionKind,
  WalletEntry,
  WalletSummary,
} from '../models/wallet.models';

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
    case TransactionKind.Income:
      return { ...base, kind: TransactionKind.Income };
    case TransactionKind.Saving:
      return { ...base, kind: TransactionKind.Saving };
    case TransactionKind.FixedExpense:
      return { ...base, kind: TransactionKind.FixedExpense, paidMonths: {} };
    case TransactionKind.VariableExpense:
      return {
        ...base,
        kind: TransactionKind.VariableExpense,
        paid: false,
        installment: data.installment,
      };
    default:
      assertNever(data.kind);
  }
}

export function isEntryPaidInMonth(entry: WalletEntry, month: MonthKey): boolean {
  switch (entry.kind) {
    case TransactionKind.FixedExpense:
      return Boolean(entry.paidMonths[month]);
    case TransactionKind.VariableExpense:
      return entry.paid;
    default:
      return false;
  }
}

export function groupByKind(entries: readonly WalletEntry[]): EntriesByKind {
  const groups: EntriesByKind = {
    [TransactionKind.Income]: [],
    [TransactionKind.FixedExpense]: [],
    [TransactionKind.VariableExpense]: [],
    [TransactionKind.Saving]: [],
  };

  for (const entry of entries) {
    // O TypeScript não consegue relacionar `entry.kind` com a lista certa sozinho,
    // então afirmamos que a lista aceita WalletEntry. É seguro: a chave é o próprio kind.
    (groups[entry.kind] as WalletEntry[]).push(entry);
  }

  return groups;
}

export function sumValues(entries: readonly WalletEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.value, 0);
}

export function sumUnpaid(entries: readonly WalletEntry[], month: MonthKey): number {
  return sumValues(
    entries.filter(
      (entry) =>
        (entry.kind === TransactionKind.FixedExpense ||
          entry.kind === TransactionKind.VariableExpense) &&
        !isEntryPaidInMonth(entry, month),
    ),
  );
}

export function assertNever(valeu: never): never {
  throw new Error(`Tipo de lançamento não tratado: ${String(valeu)}`);
}

export function isEntryVisibleInMonth(entry: WalletEntry, month: MonthKey): boolean {
  if (entry.kind !== TransactionKind.FixedExpense) {
    return entry.month === month;
  }

  return entry.month <= month && (!entry.deletedFromMonth || month < entry.deletedFromMonth);
}

export function summarize(groups: EntriesByKind): WalletSummary {
  const income = sumValues(groups[TransactionKind.Income]);
  const fixedExpenses = sumValues(groups[TransactionKind.FixedExpense]);
  const variableExpenses = sumValues(groups[TransactionKind.VariableExpense]);
  const savings = sumValues(groups[TransactionKind.Saving]);

  return {
    income,
    fixedExpenses,
    variableExpenses,
    savings,
    balance: income - fixedExpenses - variableExpenses - savings,
  };
}
