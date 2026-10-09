import { Injectable, signal } from '@angular/core';
import { WalletEntry } from '../models/wallet.models';
import { getCurrentMonth } from '../utils/month.utils';
import { createId } from '../../id-generator';
import { createEntry, NewEntryData } from '../utils/entry.utils';
import { parseWalletEntry } from '../utils/entry-parser';

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
        e.kind === 'saving' &&
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

  private normalizeDescription(description: string): string {
    return description
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/gi, '')
      .toLowerCase()
      .trim();
  }

  remove(id: string, month: string): void {
    const entries = this.entriesSignal();
    const entryToRemove = entries.find((entry) => entry.id === id);

    if (!entryToRemove) {
      return;
    }

    if (entryToRemove.kind === 'fixed-expense') {
      this.save(
        entries.map((entry) =>
          entry.id === id && entry.kind === 'fixed-expense'
            ? { ...entry, deletedFromMonth: month }
            : entry,
        ),
      );
      return;
    }

    this.save(entries.filter((entry) => !this.shouldRemoveEntry(entry, entryToRemove)));
  }

  togglePaid(id: string, month: string): void {
    this.save(
      this.entriesSignal().map((entry): WalletEntry => {
        if (entry.id !== id) {
          return entry;
        }

        switch (entry.kind) {
          case 'fixed-expense':
            return {
              ...entry,
              paidMonths: { ...entry.paidMonths, [month]: !entry.paidMonths[month] },
            };
          case 'variable-expense':
            return { ...entry, paid: !entry.paid };
          default:
            return entry; // renda e cofrinho não têm status de pago
        }
      }),
    );
  }

  clearAll(): void {
    this.save([]);
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

    if (entryToRemove.kind === 'variable-expense' && entryToRemove.installment) {
      const removed = entryToRemove.installment;

      return (
        entry.kind === 'variable-expense' &&
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
        kind: 'income' as const,
        description: String(entry['nome'] ?? ''),
        value: Number(entry['valor'] ?? 0),
        month: String(entry['mes'] ?? currentMonth),
        createdAt: now,
      })),
      ...legacyFixedExpenses.map((entry) => ({
        id: createId(),
        kind: 'fixed-expense' as const,
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
          kind: 'variable-expense' as const,
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
