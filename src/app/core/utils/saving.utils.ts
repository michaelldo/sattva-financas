import { SavingEntry, TransactionKind, WalletEntry } from '../models/wallet.models';
import { createEntry, normalizeDescription } from './entry.utils';
import { MonthKey } from './month.utils';

/** Soma em centavos para não acumular erro de ponto flutuante (0,1 + 0,2...). */
function sumCents(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value * 100), 0) / 100;
}

/** Total guardado no cofrinho até o mês informado. */
export function savedUntil(entry: SavingEntry, month: MonthKey): number {
  return sumCents(
    Object.entries(entry.deposits)
      .filter(([depositMonth]) => depositMonth <= month)
      .map(([, value]) => value),
  );
}

function withDeposits(entry: SavingEntry, deposits: Record<MonthKey, number>): SavingEntry {
  const months = Object.keys(deposits).sort();
  return {
    ...entry,
    deposits,
    value: sumCents(Object.values(deposits)),
    month: months[0] ?? entry.month,
  };
}

function findOpenSaving(
  entries: readonly WalletEntry[],
  description: string,
  month: MonthKey,
): SavingEntry | undefined {
  const name = normalizeDescription(description);
  return entries.find(
    (entry): entry is SavingEntry =>
      entry.kind === TransactionKind.Saving &&
      normalizeDescription(entry.description) === name &&
      (!entry.deletedFromMonth || month < entry.deletedFromMonth),
  );
}

/**
 * Guarda dinheiro no cofrinho. Mesmo nome = mesmo cofrinho: o valor é somado
 * ao que já foi guardado naquele mês. Nome novo = cofrinho novo.
 */
export function addDeposit(
  entries: readonly WalletEntry[],
  data: { description: string; value: number; month: MonthKey },
  now = new Date(),
): WalletEntry[] {
  const existing = findOpenSaving(entries, data.description, data.month);

  if (!existing) {
    return [...entries, createEntry({ kind: TransactionKind.Saving, ...data }, now)];
  }

  const deposits = {
    ...existing.deposits,
    [data.month]: sumCents([existing.deposits[data.month] ?? 0, data.value]),
  };
  return entries.map((entry) =>
    entry.id === existing.id ? withDeposits(existing, deposits) : entry,
  );
}

/**
 * Edição do cofrinho: troca o nome e o valor guardado NO MÊS informado.
 * Os outros meses não mudam. Se não sobrar nenhum valor guardado, o cofrinho é removido.
 */
export function editSavingMonth(
  entries: readonly WalletEntry[],
  id: string,
  month: MonthKey,
  changes: { description: string; value: number },
): WalletEntry[] {
  return entries.flatMap((entry) => {
    if (entry.id !== id || entry.kind !== TransactionKind.Saving) {
      return [entry];
    }

    const deposits = { ...entry.deposits, [month]: changes.value };
    if (changes.value <= 0) {
      delete deposits[month];
    }

    return Object.keys(deposits).length === 0
      ? []
      : [{ ...withDeposits(entry, deposits), description: changes.description }];
  });
}

/**
 * Migração: antes, cada mês tinha o seu próprio lançamento de cofrinho.
 * Junta os de mesmo nome (e mesma situação de retirada) num cofrinho só.
 */
export function mergeSavingGoals(entries: readonly WalletEntry[]): WalletEntry[] {
  const merged = new Map<string, SavingEntry>();
  const result: WalletEntry[] = [];

  for (const entry of entries) {
    if (entry.kind !== TransactionKind.Saving) {
      result.push(entry);
      continue;
    }

    const key = `${normalizeDescription(entry.description)}|${entry.deletedFromMonth ?? ''}`;
    const current = merged.get(key);

    if (!current) {
      merged.set(key, entry);
      result.push(entry);
      continue;
    }

    const deposits = { ...current.deposits };
    for (const [month, value] of Object.entries(entry.deposits)) {
      deposits[month] = sumCents([deposits[month] ?? 0, value]);
    }
    const combined = withDeposits(current, deposits);
    merged.set(key, combined);
    result[result.indexOf(current)] = combined;
  }

  return result;
}
