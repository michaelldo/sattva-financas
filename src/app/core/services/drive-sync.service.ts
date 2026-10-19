import { effect, inject, Injectable, signal } from '@angular/core';
import { DriveApiService } from './drive-api.service';
import { GoogleAuthService } from './google-auth.service';
import { BackupService } from './backup.service';
import { WalletStorageService } from './wallet-storage.service';
import { decideSync, SyncAction } from '../utils/sync.utils';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'paused' | 'error';
/** Espera após a última alteração antes do envio (envio em lote das alterações) */
export const AUTO_SYNC_DELAY_MS = 3000;

@Injectable({ providedIn: 'root' })
export class DriveSyncService {
  private readonly api = inject(DriveApiService);
  private readonly auth = inject(GoogleAuthService);
  private readonly backup = inject(BackupService);
  private readonly storage = inject(WalletStorageService);

  private readonly statusSignal = signal<SyncStatus>('idle');
  private readonly lastSyncedAtSignal = signal<Date | null>(null);

  readonly status = this.statusSignal.asReadonly();
  readonly lastSyncedAt = this.lastSyncedAtSignal.asReadonly();

  private fileId: string | null = null;
  private syncedModifiedAt: string | null = null;

  constructor() {
    //Sync automatico depois de alguns segundo de alteração local
    effect((onCleanup) => {
      const modifiedAt = this.storage.lastModified();

      if (!this.auth.isConnected()) {
        return;
      }

      const timer = setTimeout(() => this.pushIfChanged(modifiedAt), AUTO_SYNC_DELAY_MS);
      onCleanup(() => clearTimeout(timer)); //Caso tenha alteração antes do prazo cancela o envio anterior
    });
  }

  async syncNow(): Promise<SyncAction> {
    this.statusSignal.set('syncing');

    try {
      const remoteFile = await this.api.findBackup();
      this.fileId = remoteFile?.id ?? null;

      const remote = remoteFile
        ? this.backup.parseBackup(await this.api.download(remoteFile.id))
        : null;
      const remoteModifiedAt = remote ? (remote.exportedAt ?? remoteFile!.modifiedTime) : null;

      const action = decideSync(
        { modifiedAt: this.storage.lastModified(), isEmpty: this.storage.entries().length === 0 },
        remoteModifiedAt,
      );

      if (action === 'download' && remote) {
        this.storage.replaceAll(remote.entries, remoteModifiedAt!);
      } else if (action === 'upload') {
        await this.upload();
      }

      this.markSynced();
      return action;
    } catch (error) {
      this.statusSignal.set('error');
      throw error;
    }
  }

  /** Esquece o estado da sessão */
  reset(): void {
    this.fileId = null;
    this.syncedModifiedAt = null;
    this.lastSyncedAtSignal.set(null);
    this.statusSignal.set('idle');
  }

  private async pushIfChanged(modifiedAt: string): Promise<void> {
    //Só envia depois da primeira sincronização com o drive, evita sobrescrever dados locais antigos e se houver algo novo
    if (this.syncedModifiedAt === null || modifiedAt === this.syncedModifiedAt) {
      return;
    }

    if (this.statusSignal() === 'syncing') {
      return;
    }

    if (!this.auth.hasValidToken()) {
      this.statusSignal.set('paused');
      return;
    }

    this.statusSignal.set('syncing');
    try {
      await this.upload();
      this.markSynced();
    } catch {
      this.statusSignal.set('error');
    }
  }

  private async upload(): Promise<void> {
    const modifiedAt = this.storage.lastModified();
    //data dos dados [ não do envio ]. Compara com outro aparelho
    const content = this.backup.serialize(this.storage.entries(), new Date(modifiedAt));

    if (this.fileId) {
      await this.api.update(this.fileId, content);
    } else {
      this.fileId = await this.api.create(content);
    }
  }

  private markSynced(): void {
    this.syncedModifiedAt = this.storage.lastModified();
    this.lastSyncedAtSignal.set(new Date());
    this.statusSignal.set('synced');
  }
}
