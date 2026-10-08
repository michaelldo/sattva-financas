import { Injectable } from '@angular/core';
import { TransactionKind, WalletEntry } from '../models/wallet.models';
import { getCurrentMonth } from '../utils/month.utils';
import { createId } from '../../id-generator';

const TRANSACTION_KINDS: readonly TransactionKind[] = [
  'income',
  'fixed-expense',
  'variable-expense',
  'saving',
];

type RawRecord = Record<string, unknown>;

function isRecord(value: unknown): value is RawRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTransactionKind(value: unknown): value is TransactionKind {
  return TRANSACTION_KINDS.includes(value as TransactionKind);
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  serialize(entries: WalletEntry[], now: Date = new Date()): string {
    const backup = {
      app: 'sattva-financas',
      version: '1.0.0',
      exportedAt: now.toISOString(),
      entries,
    };

    return JSON.stringify(backup, null, 2);
  }

  download(entries: WalletEntry[]): void {
    const blob = new Blob([this.serialize(entries)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `sattva-backupp=${getCurrentMonth()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }

  async readFile(file: File): Promise<WalletEntry[]> {
    return this.parse(await file.text());
  }

  parse(json: string): WalletEntry[] {
    const data: unknown = JSON.parse(json);
    const rawEntries = Array.isArray(data) ? data : isRecord(data) ? data['entries'] : undefined;

    if (!Array.isArray(rawEntries)) {
      throw new Error('Arquivo de backup inválido');
    }

    return rawEntries.map((raw, index) => this.toEntry(raw, index));
  }

  private toEntry(raw: unknown, index: number): WalletEntry {
    if (!isRecord(raw)) {
      throw new Error(`Lançamento ${index + 1} inválido.`);
    }

    const value = Number(raw['value']);
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Lançamento ${index + 1} com valor inválido`);
    }

    const kind = isTransactionKind(raw['kind']) ? raw['kind'] : 'variable-expense';
    const month = typeof raw['month'] === 'string' ? raw['month'] : getCurrentMonth();
    const paidMonths = isRecord(raw['paidMonths'])
      ? (raw['paidMonths'] as Record<string, boolean>)
      : raw['paid']
        ? { [month]: true }
        : {};

    return {
      id: typeof raw['id'] === 'string' ? raw['id'] : createId(),
      kind,
      description: String(raw['description'] ?? ''),
      value,
      month,
      createdAt: typeof raw['createdAt'] === 'string' ? raw['createdAt'] : new Date().toISOString(),
      paid: kind === 'variable-expense' ? Boolean(raw['paid']) : undefined,
      paidMonths: kind === 'fixed-expense' ? paidMonths : undefined,
      deletedFromMonth:
        kind === 'fixed-expense' && typeof raw['deletedFromMonth'] === 'string'
          ? raw['deletedFromMonth']
          : undefined,
      installment: raw['installment'] as WalletEntry['installment'],
    };
  }
}
