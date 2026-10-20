import { Injectable } from '@angular/core';
import { WalletEntry } from '../models/wallet.models';
import { getCurrentMonth } from '../utils/month.utils';
import { isRecord, parseWalletEntry, withUniqueIds } from '../utils/entry-parser';
import { mergeSavingGoals } from '../utils/saving.utils';

const MAX_BACKUP_SIZE_BYTES = 5 * 1024 * 1024;

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
    link.download = `sattva-backup-${getCurrentMonth()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url));
  }

  async readFile(file: File): Promise<WalletEntry[]> {
    if (file.size > MAX_BACKUP_SIZE_BYTES) {
      throw new Error('Arquivo grande demais para ser um backup do Sattva');
    }
    return this.parse(await file.text());
  }

  parse(json: string): WalletEntry[] {
    return this.parseBackup(json).entries;
  }

  /** Lê o backup e retorna as entradas e a data de exportação */
  parseBackup(json: string): { entries: WalletEntry[]; exportedAt: string | null } {
    const data: unknown = JSON.parse(json);
    const exportedAt =
      isRecord(data) && typeof data['exportedAt'] === 'string' ? data['exportedAt'] : null;
    const rawEntries = Array.isArray(data) ? data : isRecord(data) ? data['entries'] : undefined;

    if (!Array.isArray(rawEntries)) {
      throw new Error('Arquivo de backup inválido');
    }

    const entries = rawEntries.map((raw, index) => {
      try {
        return parseWalletEntry(raw);
      } catch (error) {
        const reason = error instanceof Error ? error.message : '';
        throw new Error(`Item ${index + 1}: ${reason}`, { cause: error });
      }
    });

    return { entries: mergeSavingGoals(withUniqueIds(entries)), exportedAt };
  }
}
