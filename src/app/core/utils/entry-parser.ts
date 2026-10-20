import { InstallmentInfo, TransactionKind, WalletEntry } from '../models/wallet.models';
import { getCurrentMonth, isMonthKey, MonthKey } from './month.utils';
import { createId } from './id-generator';

const TRANSACTION_KIND: readonly string[] = Object.values(TransactionKind);
export const MAX_DESCRIPTION_LENGTH = 120;

type RawRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTransactionKind(value: unknown): value is TransactionKind {
  return typeof value === 'string' && TRANSACTION_KIND.includes(value);
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}

function parseMonth(value: unknown): MonthKey | undefined {
  return isMonthKey(value) ? value : undefined;
}

/** Só aceita chaves com meses válidos */
function parsePaidMonths(value: unknown): Record<MonthKey, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([month, paid]) => isMonthKey(month) && paid === true)
      .map(([month]) => [month, true]),
  );
}

function parseDeposits(value: unknown): Record<MonthKey, number> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const deposits = Object.fromEntries(
    Object.entries(value)
      .filter(([month, amount]) => isMonthKey(month) && typeof amount === 'number' && amount > 0)
      .map(([month, amount]) => [month, Math.round((amount as number) * 100) / 100]),
  );

  return Object.keys(deposits).length > 0 ? deposits : undefined;
}

function parseDescription(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_DESCRIPTION_LENGTH) : '';
}

function parseInstallment(value: unknown): InstallmentInfo | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const groupId = optionalString(value['groupId']);
  const current = Number(value['current']);
  const total = Number(value['total']);

  return groupId && current > 0 && total > 0 ? { groupId, current, total } : undefined;
}

export function parseWalletEntry(raw: unknown): WalletEntry {
  if (!isRecord(raw)) {
    throw new Error('Lançamento inválido.');
  }

  const value = Number(raw['value']);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('Lançamento com valor inválido.');
  }

  const month = parseMonth(raw['month']) ?? getCurrentMonth();
  const base = {
    id: optionalString(raw['id']) ?? createId(),
    description: parseDescription(raw['description']),
    value: Math.round(value * 100) / 100,
    month,
    createdAt: optionalString(raw['createdAt']) ?? new Date().toISOString(),
  };

  const kind = isTransactionKind(raw['kind']) ? raw['kind'] : TransactionKind.VariableExpense;

  switch (kind) {
    case TransactionKind.Income:
      return { ...base, kind };
    case TransactionKind.Saving: {
      const deposits = parseDeposits(raw['deposits']) ?? { [month]: base.value };
      const months = Object.keys(deposits).sort();
      return {
        ...base,
        kind,
        deposits,
        value: Object.values(deposits).reduce((sum, v) => sum + Math.round(v * 100), 0) / 100,
        month: months[0],
        deletedFromMonth: parseMonth(raw['deletedFromMonth']),
      };
    }
    case TransactionKind.FixedExpense:
      return {
        ...base,
        kind,
        paidMonths: isRecord(raw['paidMonths'])
          ? parsePaidMonths(raw['paidMonths'])
          : raw['paid']
            ? { [month]: true }
            : {},
        deletedFromMonth: parseMonth(raw['deletedFromMonth']),
      };
    case TransactionKind.VariableExpense:
      return {
        ...base,
        kind,
        paid: Boolean(raw['paid']),
        installment: parseInstallment(raw['installment']),
      };
  }
}

/** Garante ids únicos */
export function withUniqueIds(entries: readonly WalletEntry[]): WalletEntry[] {
  const seen = new Set<string>();

  return entries.map((entry) => {
    const unique = seen.has(entry.id) ? { ...entry, id: createId() } : entry;
    seen.add(unique.id);
    return unique;
  });
}
