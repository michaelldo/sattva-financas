import { Injectable } from '@angular/core';
import { WalletEntry } from '../models/wallet.models';
import { getCurrentMonth } from '../utils/month.utils';
import { isRecord, parseWalletEntry } from '../utils/entry-parser';

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
    link.download = `sattva-backupp-${getCurrentMonth()}.json`;
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

    return rawEntries.map((raw, index) => {
      try {
        return parseWalletEntry(raw);
      } catch (error) {
        const reason = error instanceof Error ? error.message : '';
        throw new Error(`Item ${index + 1}: ${reason}`);
      }
    });
  }
}
