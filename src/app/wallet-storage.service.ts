import { Injectable, signal } from '@angular/core';
import { WalletEntry } from './wallet.models';

const STORAGE_KEY = 'sattva-wallet-entries-v1';

@Injectable({ providedIn: 'root' })
export class WalletStorageService {
  private readonly entriesSignal = signal<WalletEntry[]>(this.readEntries());

  readonly entries = this.entriesSignal.asReadonly();

  add(entry: Omit<WalletEntry, 'id' | 'createdAt'>): void {
    const newEntry: WalletEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.save([...this.entriesSignal(), newEntry]);
  }

  addMany(entries: Array<Omit<WalletEntry, 'id' | 'createdAt'>>): void {
    const now = new Date().toISOString();
    const newEntries = entries.map((entry) => ({
      ...entry,
      id: crypto.randomUUID(),
      createdAt: now,
    }));

    this.save([...this.entriesSignal(), ...newEntries]);
  }

  remove(id: string): void {
    const entries = this.entriesSignal();
    const entryToRemove = entries.find((entry) => entry.id === id);

    if (!entryToRemove) {
      return;
    }

    this.save(entries.filter((entry) => !this.shouldRemoveEntry(entry, entryToRemove)));
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

    try {
      return JSON.parse(rawEntries) as WalletEntry[];
    } catch {
      return [];
    }
  }

  private shouldRemoveEntry(entry: WalletEntry, entryToRemove: WalletEntry): boolean {
    if (entry.id === entryToRemove.id) {
      return true;
    }

    if (entryToRemove.installment) {
      return (
        entry.installment?.groupId === entryToRemove.installment.groupId &&
        entry.installment.current >= entryToRemove.installment.current
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

  private parseLegacyInstallment(description: string):
    | { baseName: string; current: number; total: number }
    | undefined {
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
    const currentMonth = new Date().toISOString().slice(0, 7);
    const legacyIncome = this.readLegacyList('rendas');
    const legacyFixedExpenses = this.readLegacyList('gastosFixos');
    const legacyVariableExpenses = this.readLegacyList('gastosVariaveis');

    const migratedEntries: WalletEntry[] = [
      ...legacyIncome.map((entry) => ({
        id: crypto.randomUUID(),
        kind: 'income' as const,
        description: String(entry['nome'] ?? ''),
        value: Number(entry['valor'] ?? 0),
        month: String(entry['mes'] ?? currentMonth),
        createdAt: now,
      })),
      ...legacyFixedExpenses.map((entry) => ({
        id: crypto.randomUUID(),
        kind: 'fixed-expense' as const,
        description: String(entry['nome'] ?? ''),
        value: Number(entry['valor'] ?? 0),
        month: currentMonth,
        createdAt: now,
      })),
      ...legacyVariableExpenses.map((entry) => {
        const description = String(entry['nome'] ?? '');
        const legacyInstallment = this.parseLegacyInstallment(description);

        return {
          id: crypto.randomUUID(),
          kind: 'variable-expense' as const,
          description,
          value: Number(entry['valor'] ?? 0),
          month: String(entry['mes'] ?? currentMonth),
          createdAt: now,
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
