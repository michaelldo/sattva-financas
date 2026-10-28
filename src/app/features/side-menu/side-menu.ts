import { ChangeDetectionStrategy, Component, inject, model, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { version } from '../../../../package.json';
import { BackupService } from '../../core/services/backup.service';
import { DriveSyncService } from '../../core/services/drive-sync.service';
import { GoogleAuthService } from '../../core/services/google-auth.service';
import { ToastService } from '../../core/services/toast.service';
import { WalletStorageService } from '../../core/services/wallet-storage.service';
import { SyncAction } from '../../core/utils/sync.utils';
import { Modal } from '../../shared/components/modal/modal';
import { InstallService } from '../../core/services/install.service';

const SYNC_MESSAGES: Record<SyncAction, string> = {
  download: 'Dados atualizados com o backup do Drive.',
  upload: 'Backup salvo no Drive.',
  none: 'Tudo sincronizado.',
};

/**
 * Menu lateral: sincronização com o Drive, backup manual e ferramentas.
 * Cuida sozinho do Drive e do backup; só avisa o App quando é preciso abrir o relatório.
 */
@Component({
  selector: 'app-side-menu',
  imports: [Modal, DatePipe],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SideMenu {
  private readonly storage = inject(WalletStorageService);
  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);
  protected readonly googleAuth = inject(GoogleAuthService);
  protected readonly driveSync = inject(DriveSyncService);
  protected readonly installer = inject(InstallService);

  readonly installHelpOpen = signal(false);
  readonly open = model(false);
  readonly openReport = output<void>();

  readonly helpOpen = signal(false);
  protected readonly appVersion = version;

  requestReport(): void {
    this.open.set(false);
    this.openReport.emit();
  }

  async installApp(): Promise<void> {
    this.open.set(false);

    if (!this.installer.canPrompt()) {
      this.installHelpOpen.set(true);
      return;
    }

    if (await this.installer.prompt()) {
      this.toast.success('App instalado!');
    }
  }

  openHelp(): void {
    this.open.set(false);
    this.helpOpen.set(true);
  }

  exportBackup(): void {
    this.backup.download(this.storage.entries());
  }

  async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const entries = await this.backup.readFile(file);
      const previous = this.storage.entries();

      this.storage.replaceAll(entries);
      this.open.set(false);
      // Importar substitui TUDO: oferece desfazer, como na exclusão.
      this.toast.show('Backup importado com sucesso!', {
        kind: 'success',
        duration: 8000,
        action: { label: 'Desfazer', run: () => this.storage.replaceAll(previous) },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Erro desconhecido';
      this.toast.error(`Não foi possível importar este arquivo. ${reason}`);
    } finally {
      input.value = '';
    }
  }

  async connectDrive(): Promise<void> {
    try {
      await this.googleAuth.connect();
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Não foi possível conectar.');
      return;
    }

    await this.syncDrive();
  }

  async syncDrive(): Promise<void> {
    try {
      // getAccessToken abre o popup se o token venceu — ok, aqui veio de um clique.
      await this.googleAuth.getAccessToken();
      const action = await this.driveSync.syncNow();
      this.toast.success(SYNC_MESSAGES[action]);
    } catch {
      this.toast.error('Não foi possível sincronizar com o Google Drive.');
    }
  }

  disconnectDrive(): void {
    this.googleAuth.disconnect();
    this.driveSync.reset();
    this.toast.show('Google Drive desconectado.');
  }
}
