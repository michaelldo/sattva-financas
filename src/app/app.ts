import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { getCurrentMonth } from './core/utils/month.utils';
import { BackupService } from './core/services/backup.service';
import { buildInstallments, remainingAfterInstallment } from './core/utils/installments';
import { groupByKind, isEntryVisibleInMonth, summarize, sumUnpaid } from './core/utils/entry.utils';
import { TransactionKind, WalletEntry, WalletSummary } from './core/models/wallet.models';
import { WalletStorageService } from './core/services/wallet-storage.service';
import { createId } from './id-generator';
import { EntryCard } from './features/entry-card/entry-card';
import { MonthPicker } from './features/month-picker/month-picker';
import { Modal } from './shared/components/modal/modal';
import { version } from '../../package.json';
import { ToastContainer } from './shared/components/toast-container/toast-container';
import { ToastService } from './core/services/toast.service';
import { GoogleAuthService } from './core/services/google-auth.service';
import { SyncAction } from './core/utils/sync.utils';
import { DriveSyncService } from './core/services/drive-sync.service';
import { ReportDialog } from './features/report-dialog/report-dialog';
import { EntryForm, EntryFormValue } from './features/entry-form/entry-form';
import { EditEntryDialog } from './features/edit-entry-dialog/edit-entry-dialog';

const SYNC_MESSAGES: Record<SyncAction, string> = {
  download: 'Dados atualizados com o backup do Drive.',
  upload: 'Backup salvo no Drive.',
  none: 'Tudo sincronizado.',
};

@Component({
  selector: 'app-root',
  imports: [
    CurrencyPipe,
    DatePipe,
    EntryCard,
    MonthPicker,
    Modal,
    ToastContainer,
    ReportDialog,
    EntryForm,
    EditEntryDialog,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly walletStorage = inject(WalletStorageService);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);
  protected readonly googleAuth = inject(GoogleAuthService);
  protected readonly Kind = TransactionKind;
  protected readonly driveSync = inject(DriveSyncService);

  readonly appVersion = version;
  readonly currentMonth = signal(getCurrentMonth());
  readonly backupHelpOpen = signal(false);
  readonly reportOpen = signal(false);
  readonly menuOpen = signal(false);
  readonly editingEntry = signal<WalletEntry | null>(null);

  readonly entries = this.walletStorage.entries;
  readonly selectedMonthEntries = computed(() =>
    this.entries()
      .filter((entry) => isEntryVisibleInMonth(entry, this.currentMonth()))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
  readonly entriesByKind = computed(() => groupByKind(this.selectedMonthEntries()));
  /** para cada parcela, quanto falta pagar */
  readonly installmentsRemaining = computed(() => remainingAfterInstallment(this.entries()));
  readonly amountToPay = computed(() => {
    const groups = this.entriesByKind();
    return sumUnpaid(
      [...groups[TransactionKind.FixedExpense], ...groups[TransactionKind.VariableExpense]],
      this.currentMonth(),
    );
  });
  readonly summary = computed<WalletSummary>(() => summarize(this.entriesByKind()));

  constructor() {
    effect(() => {
      if (this.walletStorage.saveFailed()) {
        this.toast.error('Não foi possível salvar: armazenamento cheio ou bloqueado');
      }
    });

    this.swUpdate?.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() =>
        this.toast.show('Nova versão disponível.', {
          duration: null,
          action: { label: 'Atualizar', run: () => document.location.reload() },
        }),
      );
  }

  /** Recebe o formulário já validado de um card e grava conforme o tipo. */
  addEntry(kind: TransactionKind, { description, value, installments }: EntryFormValue): void {
    const month = this.currentMonth();

    switch (kind) {
      case TransactionKind.VariableExpense:
        this.walletStorage.addMany(
          buildInstallments({
            description,
            total: value,
            count: installments,
            startMonth: month,
            groupId: createId(),
          }),
        );
        return;
      case TransactionKind.Saving:
        // cofrinho com o mesmo nome no mês soma no existente
        this.walletStorage.addOrUpdateSaving({ kind, description, value, month });
        return;
      default:
        this.walletStorage.add({ kind, description, value, month });
    }
  }

  removeEntry(id: string): void {
    const removed = this.walletStorage.remove(id, this.currentMonth());

    if (removed.length === 0) {
      return;
    }

    this.toast.show(this.removalMessage(removed), {
      duration: 6000,
      action: { label: 'Desfazer', run: () => this.walletStorage.restore(removed) },
    });
  }

  private removalMessage(removed: WalletEntry[]): string {
    if (removed[0].kind === TransactionKind.FixedExpense) {
      return 'Gasto fixo encerrado!';
    }

    return removed.length > 1 ? `${removed.length} parcelas excluídas.` : 'Lançamento excluído!';
  }

  togglePaidStatus(entry: WalletEntry): void {
    this.walletStorage.togglePaid(entry.id, this.currentMonth());
  }

  exportBackup(): void {
    this.backup.download(this.entries());
  }

  async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const entries = await this.backup.readFile(file);
      const previous = this.entries();

      this.walletStorage.replaceAll(entries);
      this.menuOpen.set(false);
      this.toast.show('Backup importado com sucesso!', {
        kind: 'success',
        duration: 8000,
        action: { label: 'Desfazer', run: () => this.walletStorage.replaceAll(previous) },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Erro desconhecido';
      this.toast.error(`Não foi possível importar este arquivo. ${reason}`);
    } finally {
      input.value = '';
    }
  }

  openFromMenu(modal: 'report' | 'help'): void {
    this.menuOpen.set(false);
    (modal === 'report' ? this.reportOpen : this.backupHelpOpen).set(true);
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
