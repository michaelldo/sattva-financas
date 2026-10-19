import { CurrencyPipe, DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { getCurrentMonth } from './core/utils/month.utils';
import { MAX_DESCRIPTION_LENGTH } from './core/utils/entry-parser';
import { BackupService } from './core/services/backup.service';
import {
  buildInstallments,
  remainingAfterInstallment,
  stripInstallmentSuffix,
} from './core/utils/installments';
import {
  groupByKind,
  isEntryVisibleInMonth,
  summarize,
  sumUnpaid,
  sumValues,
} from './core/utils/entry.utils';
import { TransactionKind, WalletEntry, WalletSummary } from './core/models/wallet.models';
import { WalletStorageService } from './core/services/wallet-storage.service';
import { RealMask } from './shared/directives/real-mask';
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

const SYNC_MESSAGES: Record<SyncAction, string> = {
  download: 'Dados atualizados com o backup do Drive.',
  upload: 'Backup salvo no Drive.',
  none: 'Tudo sincronizado.',
};

const MAX_INSTALLMENTS = 120;

const DESCRIPTION_VALIDATORS = [
  Validators.required,
  Validators.pattern(/\S/),
  Validators.maxLength(MAX_DESCRIPTION_LENGTH),
];
const VALUE_VALIDATORS = [Validators.required, Validators.min(0.01)];
const INSTALLMENTS_VALIDATORS = [
  Validators.required,
  Validators.min(1),
  Validators.max(MAX_INSTALLMENTS),
];

@Component({
  selector: 'app-root',
  imports: [
    CurrencyPipe,
    DatePipe,
    ReactiveFormsModule,
    RealMask,
    EntryCard,
    MonthPicker,
    Modal,
    ToastContainer,
    ReportDialog,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly formBuilder = inject(FormBuilder);
  private readonly walletStorage = inject(WalletStorageService);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly backup = inject(BackupService);
  private readonly toast = inject(ToastService);
  protected readonly googleAuth = inject(GoogleAuthService);
  protected readonly Kind = TransactionKind;
  protected readonly driveSync = inject(DriveSyncService);
  protected readonly maxInstallments = MAX_INSTALLMENTS;
  protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;

  readonly appVersion = version;
  readonly currentMonth = signal(getCurrentMonth());
  readonly backupHelpOpen = signal(false);
  readonly reportOpen = signal(false);
  readonly menuOpen = signal(false);
  readonly editingEntry = signal<WalletEntry | null>(null);

  readonly editForm = this.formBuilder.nonNullable.group({
    description: ['', DESCRIPTION_VALIDATORS],
    value: [null as number | null, VALUE_VALIDATORS],
    installments: [1, INSTALLMENTS_VALIDATORS],
  });
  readonly editingInstallment = computed(() => {
    const entry = this.editingEntry();
    return entry?.kind === TransactionKind.VariableExpense && entry.installment
      ? entry.installment
      : null;
  });
  readonly entries = this.walletStorage.entries;
  readonly incomeForm = this.createMoneyForm();
  readonly fixedExpenseForm = this.createMoneyForm();
  readonly variableExpenseForm = this.formBuilder.nonNullable.group({
    description: ['', DESCRIPTION_VALIDATORS],
    value: [null as number | null, VALUE_VALIDATORS],
    isInstallment: [false],
    installments: [1, INSTALLMENTS_VALIDATORS],
  });
  readonly savingForm = this.createMoneyForm();
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

  addIncome(): void {
    this.addSimpleEntry(TransactionKind.Income, this.incomeForm);
  }

  addFixedExpense(): void {
    this.addSimpleEntry(TransactionKind.FixedExpense, this.fixedExpenseForm);
  }

  addSaving(): void {
    if (this.savingForm.invalid) {
      this.savingForm.markAllAsTouched();
      return;
    }

    const { description, value } = this.savingForm.getRawValue();
    this.walletStorage.addOrUpdateSaving({
      kind: TransactionKind.Saving,
      description: description.trim(),
      value: Number(value),
      month: this.currentMonth(),
    });
    this.savingForm.reset();
  }

  addVariableExpense(): void {
    if (this.variableExpenseForm.invalid) {
      this.variableExpenseForm.markAllAsTouched();
      return;
    }

    const { description, value, isInstallment, installments } =
      this.variableExpenseForm.getRawValue();

    const entries = buildInstallments({
      description: description.trim(),
      total: Number(value),
      count: isInstallment ? installments : 1,
      startMonth: this.currentMonth(),
      groupId: createId(),
    });

    this.walletStorage.addMany(entries);
    this.variableExpenseForm.reset();
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

  startEdit(entry: WalletEntry): void {
    this.editingEntry.set(entry);

    if (entry.kind === TransactionKind.VariableExpense && entry.installment) {
      const groupId = entry.installment.groupId;
      const group = this.entries().filter(
        (item) =>
          item.kind === TransactionKind.VariableExpense && item.installment?.groupId === groupId,
      );

      this.editForm.reset({
        description: stripInstallmentSuffix(entry.description),
        value: sumValues(group),
        installments: entry.installment.total,
      });
      return;
    }
    this.editForm.reset({ description: entry.description, value: entry.value, installments: 1 });
  }

  saveEdit(): void {
    const entry = this.editingEntry();

    if (!entry || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    const raw = this.editForm.getRawValue();
    const description = raw.description.trim();
    const value = Number(raw.value);

    if (entry.kind === TransactionKind.VariableExpense && entry.installment) {
      this.walletStorage.editInstallmentGroup(entry.installment.groupId, {
        description,
        total: value,
        installments: Number(raw.installments),
      });
    } else if (entry.kind === TransactionKind.FixedExpense) {
      this.walletStorage.editFixedFromMonth(entry.id, this.currentMonth(), { description, value });
    } else {
      this.walletStorage.update(entry.id, { description, value });
    }

    this.editingEntry.set(null);
  }

  /** Chamado quando o modal muda de estado: ao fechar, cancela a edição */
  onEditModalChange(open: boolean): void {
    if (!open) {
      this.editingEntry.set(null);
    }
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

  private addSimpleEntry(kind: TransactionKind, form: MoneyForm): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const { description, value } = form.getRawValue();
    this.walletStorage.add({
      kind,
      description: description.trim(),
      value: Number(value),
      month: this.currentMonth(),
    });
    form.reset();
  }

  private createMoneyForm() {
    return this.formBuilder.nonNullable.group({
      description: ['', DESCRIPTION_VALIDATORS],
      value: [null as number | null, VALUE_VALIDATORS],
    });
  }
}

/** O tipo é inferido no método, se o formulário mudar, o tipo acompanha */
type MoneyForm = ReturnType<App['createMoneyForm']>;
