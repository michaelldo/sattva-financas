import { Injectable, signal } from '@angular/core';
import { WalletEntry } from './wallet.models';
import { createId } from './id-generator';

const STORAGE_KEY = 'sattva-wallet-entries-v1';

@Injectable({ providedIn: 'root' })
export class WalletStorageService {
  private readonly entriesSignal = signal<WalletEntry[]>(this.readEntries());

  readonly entries = this.entriesSignal.asReadonly();

  add(entry: Omit<WalletEntry, 'id' | 'createdAt'>): void {
    const newEntry: WalletEntry = {
      ...entry,
      id: createId(),
      createdAt: new Date().toISOString(),
      paid: entry.kind === 'variable-expense' ? false : undefined,
      paidMonths: entry.kind === 'fixed-expense' ? {} : undefined,
    };

    this.save([...this.entriesSignal(), newEntry]);
  }

  addMany(entries: Array<Omit<WalletEntry, 'id' | 'createdAt'>>): void {
    const now = new Date().toISOString();
    const newEntries = entries.map((entry) => ({
      ...entry,
      id: createId(),
      createdAt: now,
      paid: entry.kind === 'variable-expense' ? false : undefined,
      paidMonths: entry.kind === 'fixed-expense' ? {} : undefined,
    }));

    this.save([...this.entriesSignal(), ...newEntries]);
  }

  addOrUpdateSaving(entry: Omit<WalletEntry, 'id' | 'createdAt'>): void {
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

  update(id: string, entry: Partial<WalletEntry>): void {
    this.save(
      this.entriesSignal().map((e) => {
        if (e.id !== id) {
          return e;
        }
        return { ...e, ...entry };
      }),
    );
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
        entries.map((entry) => {
          if (entry.id !== id) {
            return entry;
          }

          return {
            ...entry,
            deletedFromMonth: month,
          };
        }),
      );
      return;
    }

    this.save(entries.filter((entry) => !this.shouldRemoveEntry(entry, entryToRemove)));
  }

  togglePaid(id: string, month: string): void {
    this.save(
      this.entriesSignal().map((entry) => {
        if (entry.id !== id || !this.supportsPaidStatus(entry.kind)) {
          return entry;
        }

        if (entry.kind === 'fixed-expense') {
          const paidMonths = entry.paidMonths ?? {};

          return {
            ...entry,
            paid: undefined,
            paidMonths: {
              ...paidMonths,
              [month]: !paidMonths[month],
            },
          };
        }

        return {
          ...entry,
          paid: !entry.paid,
        };
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

  private supportsPaidStatus(kind: WalletEntry['kind']): boolean {
    return kind === 'fixed-expense' || kind === 'variable-expense';
  }

  private readEntries(): WalletEntry[] {
    const rawEntries = localStorage.getItem(STORAGE_KEY);

    if (!rawEntries) {
      return this.migrateLegacyEntries();
    }

    try {
      return (JSON.parse(rawEntries) as WalletEntry[]).map((entry) =>
        this.normalizeStoredEntry(entry),
      );
    } catch {
      return [];
    }
  }

  private normalizeStoredEntry(entry: WalletEntry): WalletEntry {
    if (entry.kind === 'fixed-expense') {
      return {
        ...entry,
        paid: undefined,
        paidMonths: entry.paidMonths ?? (entry.paid ? { [entry.month]: true } : {}),
        deletedFromMonth: entry.deletedFromMonth,
      };
    }

    if (entry.kind === 'variable-expense') {
      return {
        ...entry,
        paid: Boolean(entry.paid),
        paidMonths: undefined,
      };
    }

    return {
      ...entry,
      paid: undefined,
      paidMonths: undefined,
      deletedFromMonth: undefined,
    };
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
    const currentMonth = new Date().toISOString().slice(0, 7);
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
