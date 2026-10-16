import { InstallmentInfo, TransactionKind, WalletEntry } from '../models/wallet.models';
import { getCurrentMonth } from './month.utils';
import { createId } from '../../id-generator';

const TRANSACTION_KIND: readonly string[] = Object.values(TransactionKind);

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

  const month = optionalString(raw['month']) ?? getCurrentMonth();
  const base = {
    id: optionalString(raw['id']) ?? createId(),
    description: String(raw['description'] ?? ''),
    value,
    month,
    createdAt: optionalString(raw['createdAt']) ?? new Date().toISOString(),
  };

  const kind = isTransactionKind(raw['kind']) ? raw['kind'] : TransactionKind.VariableExpense;

  switch (kind) {
    case TransactionKind.Income:
      return { ...base, kind };
    case TransactionKind.Saving:
      return { ...base, kind };
    case TransactionKind.FixedExpense:
      return {
        ...base,
        kind,
        paidMonths: isRecord(raw['paidMonths'])
          ? (raw['paidMonths'] as Record<string, boolean>)
          : raw['paid']
            ? { [month]: true }
            : {},
        deletedFromMonth: optionalString(raw['deletedFromMonth']),
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
