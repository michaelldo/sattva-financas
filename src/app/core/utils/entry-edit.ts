import {
  FixedExpenseEntry,
  TransactionKind,
  VariableExpenseEntry,
  WalletEntry,
} from '../models/wallet.models';
import { createId } from './id-generator';
import { addMonths, MonthKey } from './month.utils';
import { buildInstallments } from './installments';

export interface EntryChanges {
  description: string;
  value: number;
}

export interface InstallmentChanges {
  description: string;
  total: number;
  installments: number;
}

/**
 * Edita um gasto fixo a partir de um mês:
 * - meses anteriores continuam com os dados antigos
 * - meses posteriores são atualizados com os novos dados
 */
export function editFixedFromMonth(
  entries: WalletEntry[],
  id: string,
  month: MonthKey,
  changes: EntryChanges,
): WalletEntry[] {
  const original = entries.find(
    (entry): entry is FixedExpenseEntry =>
      entry.id === id && entry.kind === TransactionKind.FixedExpense,
  );

  if (!original) {
    return entries;
  }

  if (month <= original.month) {
    return entries.map((entry) => (entry.id === id ? { ...entry, ...changes } : entry));
  }

  const paidBefore: Record<string, boolean> = {};
  const paidFrom: Record<string, boolean> = {};

  for (const [paidMonth, paid] of Object.entries(original.paidMonths)) {
    (paidMonth < month ? paidBefore : paidFrom)[paidMonth] = paid;
  }

  const closed: FixedExpenseEntry = {
    ...original,
    paidMonths: paidBefore,
    deletedFromMonth: month,
  };

  const continuation: FixedExpenseEntry = {
    ...original,
    ...changes,
    id: createId(),
    month,
    paidMonths: paidFrom,
    deletedFromMonth: original.deletedFromMonth,
  };

  return entries.flatMap((entry) => (entry.id === id ? [closed, continuation] : entry));
}

/**
 * Recalcula todas as parcelas de uma compra a partir  do valor total e da quantidade.
 * Parcelas que continuam existindo mantêm o id e os status pago.
 */
export function editInstallmentGroup(
  entries: WalletEntry[],
  groupId: string,
  changes: InstallmentChanges,
): WalletEntry[] {
  const group = entries
    .filter(
      (entry): entry is VariableExpenseEntry =>
        entry.kind === TransactionKind.VariableExpense && entry.installment?.groupId === groupId,
    )
    .sort((a, b) => a.installment!.current - b.installment!.current);

  if (group.length === 0) {
    return entries;
  }

  const first = group[0];
  const byNumber = new Map(group.map((entry) => [entry.installment!.current, entry]));

  const rebuilt = buildInstallments({
    description: changes.description,
    total: changes.total,
    count: changes.installments,
    startMonth: addMonths(first.month, -(first.installment!.current - 1)),
    groupId,
  }).map((data, index): VariableExpenseEntry => {
    const previous = byNumber.get(index + 1);

    return {
      id: previous?.id ?? createId(),
      kind: TransactionKind.VariableExpense,
      description: data.description,
      value: data.value,
      month: data.month,
      createdAt: first.createdAt,
      paid: previous?.paid ?? false,
      installment: data.installment,
    };
  });

  const groupIds = new Set(group.map((entry) => entry.id));
  const others = entries.filter((entry) => !groupIds.has(entry.id));
  return [...others, ...rebuilt];
}

/**
 * Desfaz uma alteração: devolve à lista as versões originais dos lançamentos
 */
export function restoreEntries(
  entries: WalletEntry[],
  originals: readonly WalletEntry[],
): WalletEntry[] {
  const originalById = new Map(originals.map((entry) => [entry.id, entry]));
  const currentIds = new Set(entries.map((entry) => entry.id));

  const updated = entries.map((entry) => originalById.get(entry.id) ?? entry);
  const missing = originals.filter((entry) => !currentIds.has(entry.id));

  return [...updated, ...missing];
}
