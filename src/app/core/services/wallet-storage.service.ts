import { Injectable, signal } from '@angular/core';
import { TransactionKind, WalletEntry } from '../models/wallet.models';
import { getCurrentMonth } from '../utils/month.utils';
import { createId } from '../../id-generator';
import { createEntry, NewEntryData } from '../utils/entry.utils';
import { parseWalletEntry } from '../utils/entry-parser';
import {
  editFixedFromMonth,
  editInstallmentGroup,
  EntryChanges,
  InstallmentChanges,
  restoreEntries,
} from '../utils/entry-edit';

const STORAGE_KEY = 'sattva-wallet-entries-v1';

@Injectable({ providedIn: 'root' })
export class WalletStorageService {
  private readonly entriesSignal = signal<WalletEntry[]>(this.readEntries());

  readonly entries = this.entriesSignal.asReadonly();

  add(data: NewEntryData): void {
    this.save([...this.entriesSignal(), createEntry(data)]);
  }

  addMany(items: NewEntryData[]): void {
    const now = new Date();
    this.save([...this.entriesSignal(), ...items.map((data) => createEntry(data, now))]);
  }

  addOrUpdateSaving(entry: NewEntryData): void {
    const normalizedDescription = this.normalizeDescription(entry.description);
    const existingEntry = this.entriesSignal().find(
      (e) =>
        e.kind === TransactionKind.Saving &&
        e.month === entry.month &&
        this.normalizeDescription(e.description) === normalizedDescription,
    );

    if (existingEntry) {
      this.update(existingEntry.id, { value: existingEntry.value + entry.value });
    } else {
      this.add(entry);
    }
  }

  update(id: string, changes: Partial<Pick<WalletEntry, 'description' | 'value'>>): void {
    this.save(this.entriesSignal().map((e) => (e.id === id ? { ...e, ...changes } : e)));
  }

  editFixedFromMonth(id: string, month: string, changes: EntryChanges): void {
    this.save(editFixedFromMonth(this.entriesSignal(), id, month, changes));
  }

  editInstallmentGroup(groupId: string, changes: InstallmentChanges): void {
    this.save(editInstallmentGroup(this.entriesSignal(), groupId, changes));
  }

  private normalizeDescription(description: string): string {
    return description
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Remove um lançamento e permite voltar a versão original do lançamento
   */
  remove(id: string, month: string): WalletEntry[] {
    const entries = this.entriesSignal();
    const entryToRemove = entries.find((entry) => entry.id === id);

    if (!entryToRemove) {
      return [];
    }

    if (entryToRemove.kind === TransactionKind.FixedExpense) {
      this.save(
        entries.map((entry) =>
          entry.id === id && entry.kind === TransactionKind.FixedExpense
            ? { ...entry, deletedFromMonth: month }
            : entry,
        ),
      );
      return [entryToRemove];
    }
    const removed = entries.filter((entry) => this.shouldRemoveEntry(entry, entryToRemove));
    this.save(entries.filter((entry) => !removed.includes(entry)));
    return removed;
  }

  /**
   * Desfaz uma remoção de lançamento
   */
  restore(originals: readonly WalletEntry[]): void {
    this.save(restoreEntries(this.entriesSignal(), originals));
  }

  togglePaid(id: string, month: string): void {
    this.save(
      this.entriesSignal().map((entry): WalletEntry => {
        if (entry.id !== id) {
          return entry;
        }

        switch (entry.kind) {
          case TransactionKind.FixedExpense:
            return {
              ...entry,
              paidMonths: { ...entry.paidMonths, [month]: !entry.paidMonths[month] },
            };
          case TransactionKind.VariableExpense:
            return { ...entry, paid: !entry.paid };
          default:
            return entry; // renda e cofrinho não têm status de pago
        }
      }),
    );
  }

  replaceAll(entries: WalletEntry[]): void {
    this.save(entries);
  }

  private save(entries: WalletEntry[]): void {
    this.entriesSignal.set(entries);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  private readEntries(): WalletEntry[] {
    const rawEntries = localStorage.getItem(STORAGE_KEY);

    if (!rawEntries) {
      return this.migrateLegacyEntries();
    }

    let stored: unknown;
    try {
      stored = JSON.parse(rawEntries);
    } catch {
      return [];
    }

    if (!Array.isArray(stored)) {
      return [];
    }

    return stored.flatMap((raw) => {
      try {
        return [parseWalletEntry(raw)];
      } catch {
        return [];
      }
    });
  }

  private shouldRemoveEntry(entry: WalletEntry, entryToRemove: WalletEntry): boolean {
    if (entry.id === entryToRemove.id) {
      return true;
    }

    if (entryToRemove.kind === TransactionKind.VariableExpense && entryToRemove.installment) {
      const removed = entryToRemove.installment;

      return (
        entry.kind === TransactionKind.VariableExpense &&
        entry.installment?.groupId === removed.groupId &&
        entry.installment.current >= removed.current
      );
    }

    const removedLegacyInstallment = this.parseLegacyInstallment(entryToRemove.description);
    const entryLegacyInstallment = this.parseLegacyInstallment(entry.description);

    if (!removedLegacyInstallment || !entryLegacyInstallment) {
      return false;
    }

    return (
      entry.kind === entryToRemove.kind &&
      entry.month >= entryToRemove.month &&
      entryLegacyInstallment.baseName === removedLegacyInstallment.baseName &&
      entryLegacyInstallment.total === removedLegacyInstallment.total &&
      entryLegacyInstallment.current >= removedLegacyInstallment.current
    );
  }

  private parseLegacyInstallment(
    description: string,
  ): { baseName: string; current: number; total: number } | undefined {
    const match = description.match(/^(.*)\s+Parc\.:(\d+)\/(\d+)$/i);

    if (!match) {
      return undefined;
    }

    return {
      baseName: match[1].trim(),
      current: Number(match[2]),
      total: Number(match[3]),
    };
  }

  private migrateLegacyEntries(): WalletEntry[] {
    const now = new Date().toISOString();
    const currentMonth = getCurrentMonth();
    const legacyIncome = this.readLegacyList('rendas');
    const legacyFixedExpenses = this.readLegacyList('gastosFixos');
    const legacyVariableExpenses = this.readLegacyList('gastosVariaveis');

    const migratedEntries: WalletEntry[] = [
      ...legacyIncome.map((entry) => ({
        id: createId(),
        kind: TransactionKind.Income,
        description: String(entry['nome'] ?? ''),
        value: Number(entry['valor'] ?? 0),
        month: String(entry['mes'] ?? currentMonth),
        createdAt: now,
      })),
      ...legacyFixedExpenses.map((entry) => ({
        id: createId(),
        kind: TransactionKind.FixedExpense,
        description: String(entry['nome'] ?? ''),
        value: Number(entry['valor'] ?? 0),
        month: currentMonth,
        createdAt: now,
        paidMonths: {},
      })),
      ...legacyVariableExpenses.map((entry) => {
        const description = String(entry['nome'] ?? '');
        const legacyInstallment = this.parseLegacyInstallment(description);

        return {
          id: createId(),
          kind: TransactionKind.VariableExpense,
          description,
          value: Number(entry['valor'] ?? 0),
          month: String(entry['mes'] ?? currentMonth),
          createdAt: now,
          paid: false,
          installment: legacyInstallment
            ? {
                groupId: `${legacyInstallment.baseName}-${legacyInstallment.total}`,
                current: legacyInstallment.current,
                total: legacyInstallment.total,
              }
            : undefined,
        };
      }),
    ].filter((entry) => entry.description && entry.value > 0);

    if (migratedEntries.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedEntries));
    }

    return migratedEntries;
  }

  private readLegacyList(key: string): Array<Record<string, unknown>> {
    const rawValue = localStorage.getItem(key);

    if (!rawValue) {
      return [];
    }

    try {
      const value = JSON.parse(rawValue);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
}
