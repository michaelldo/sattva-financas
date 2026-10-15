import { CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { getCurrentMonth } from './core/utils/month.utils';
import { BackupService } from './core/services/backup.service';
import { ReportService } from './core/services/report.service';
import { buildInstallments, stripInstallmentSuffix } from './core/utils/installments';
import { groupByKind, isEntryPaidInMonth, sumUnpaid, sumValues } from './core/utils/entry.utils';
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

@Component({
  selector: 'app-root',
  imports: [
    CurrencyPipe,
    DatePipe,
    NgClass,
    ReactiveFormsModule,
    RealMask,
    EntryCard,
    MonthPicker,
    Modal,
    ToastContainer,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly formBuilder = inject(FormBuilder);
  private readonly walletStorage = inject(WalletStorageService);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly backup = inject(BackupService);
  private readonly report = inject(ReportService);
  private readonly toast = inject(ToastService);

  readonly appVersion = version;
  readonly currentMonth = signal(getCurrentMonth());
  readonly viewedYear = signal(Number(this.currentMonth().slice(0, 4)));
  readonly backupHelpOpen = signal(false);
  readonly reportOpen = signal(false);
  readonly menuOpen = signal(false);
  readonly editingEntry = signal<WalletEntry | null>(null);

  readonly editForm = this.formBuilder.group({
    description: ['', Validators.required],
    value: [null as number | null, [Validators.required, Validators.min(0.01)]],
    installments: [1, [Validators.required, Validators.min(1)]],
  });
  readonly editingInstallment = computed(() => {
    const entry = this.editingEntry();
    return entry?.kind === 'variable-expense' && entry.installment ? entry.installment : null;
  });
  readonly entries = this.walletStorage.entries;
  readonly incomeForm = this.createMoneyForm();
  readonly fixedExpenseForm = this.createMoneyForm();
  readonly variableExpenseForm = this.formBuilder.group({
    description: ['', Validators.required],
    value: [null as number | null, [Validators.required, Validators.min(0.01)]],
    isInstallment: [false],
    installments: [1, [Validators.required, Validators.min(1)]],
  });
  readonly savingForm = this.createMoneyForm();
  readonly selectedMonthEntries = computed(() =>
    this.entries()
      .filter((entry) => this.isEntryVisibleInCurrentMonth(entry))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
  readonly entriesByKind = computed(() => groupByKind(this.selectedMonthEntries()));
  readonly amountToPay = computed(() => {
    const groups = this.entriesByKind();
    return sumUnpaid(
      [...groups['fixed-expense'], ...groups['variable-expense']],
      this.currentMonth(),
    );
  });
  readonly summary = computed<WalletSummary>(() => {
    const groups = this.entriesByKind();
    const income = sumValues(groups.income);
    const fixedExpenses = sumValues(groups['fixed-expense']);
    const variableExpenses = sumValues(groups['variable-expense']);
    const savings = sumValues(groups.saving);
    return {
      income,
      fixedExpenses,
      variableExpenses,
      savings,
      balance: income - fixedExpenses - variableExpenses - savings,
    };
  });
  readonly reportText = computed(() =>
    this.report.build({
      month: this.currentMonth(),
      summary: this.summary(),
      fixedEntries: this.entriesByKind()['fixed-expense'],
      allEntries: this.entries(),
    }),
  );

  constructor() {
    const swUpdate = this.swUpdate;

    if (!swUpdate?.isEnabled) {
      return;
    }

    swUpdate.versionUpdates
      .pipe(filter((event): event is VersionReadyEvent => event.type === 'VERSION_READY'))
      .subscribe(() => window.location.reload());
  }

  addIncome(): void {
    this.addSimpleEntry('income', this.incomeForm);
  }

  addFixedExpense(): void {
    this.addSimpleEntry('fixed-expense', this.fixedExpenseForm);
  }

  addSaving(): void {
    if (this.savingForm.invalid) {
      this.savingForm.markAllAsTouched();
      return;
    }

    const { description, value } = this.savingForm.getRawValue();
    this.walletStorage.addOrUpdateSaving({
      kind: 'saving',
      description: description ?? '',
      value: Number(value),
      month: this.currentMonth(),
    });
    this.savingForm.reset({ description: '', value: null });
  }

  addVariableExpense(): void {
    if (this.variableExpenseForm.invalid) {
      this.variableExpenseForm.markAllAsTouched();
      return;
    }

    const { description, value, isInstallment, installments } =
      this.variableExpenseForm.getRawValue();

    const entries = buildInstallments({
      description: description ?? '',
      total: value ?? 0,
      count: isInstallment ? installments || 1 : 1,
      startMonth: this.currentMonth(),
      groupId: createId(),
    });

    this.walletStorage.addMany(entries);

    this.variableExpenseForm.reset({
      description: '',
      value: null,
      isInstallment: false,
      installments: 1,
    });
  }

  removeEntry(id: string): void {
    this.walletStorage.remove(id, this.currentMonth());
  }

  startEdit(entry: WalletEntry): void {
    this.editingEntry.set(entry);

    if (entry.kind === 'variable-expense' && entry.installment) {
      const groupId = entry.installment.groupId;
      const group = this.entries().filter(
        (item) => item.kind === 'variable-expense' && item.installment?.groupId === groupId,
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
    const description = (raw.description ?? '').trim();
    const value = Number(raw.value);

    if (entry.kind === 'variable-expense' && entry.installment) {
      this.walletStorage.editInstallmentGroup(entry.installment.groupId, {
        description,
        total: value,
        installments: Number(raw.installments),
      });
    } else if (entry.kind === 'fixed-expense') {
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

  isEntryPaid(entry: WalletEntry): boolean {
    return isEntryPaidInMonth(entry, this.currentMonth());
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
      this.walletStorage.replaceAll(entries);
      this.menuOpen.set(false);
      this.toast.success('Backup importado com sucesso!');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Erro desconhecido';
      this.toast.error(`Não foi possível importar este arquivo. ${reason}`);
    } finally {
      input.value = '';
    }
  }

  async copyReport(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.reportText());
      this.toast.success('Relatório copiado!');
    } catch {
      this.toast.error(`Não foi possível copiar o relatório.`);
    }
  }

  printReport(): void {
    window.print();
  }

  openFromMenu(modal: 'report' | 'help'): void {
    this.menuOpen.set(false);
    (modal === 'report' ? this.reportOpen : this.backupHelpOpen).set(true);
  }

  private addSimpleEntry(kind: TransactionKind, form: FormGroup): void {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }

    const { description, value } = form.getRawValue();
    this.walletStorage.add({
      kind,
      description,
      value: Number(value),
      month: this.currentMonth(),
    });
    form.reset({ description: '', value: null });
  }

  private createMoneyForm() {
    return this.formBuilder.group({
      description: ['', Validators.required],
      value: [null as number | null, [Validators.required, Validators.min(0.01)]],
    });
  }

  private sumByKind(entries: WalletEntry[], kind: TransactionKind): number {
    return entries
      .filter((entry) => entry.kind === kind)
      .reduce((sum, entry) => sum + entry.value, 0);
  }

  private isEntryVisibleInCurrentMonth(entry: WalletEntry): boolean {
    if (entry.kind !== 'fixed-expense') {
      return entry.month === this.currentMonth();
    }

    return (
      entry.month <= this.currentMonth() &&
      (!entry.deletedFromMonth || this.currentMonth() < entry.deletedFromMonth)
    );
  }

  protected readonly open = open;
}
