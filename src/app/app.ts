import { CurrencyPipe, DatePipe, NgClass } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';
import { TransactionKind, WalletEntry, WalletSummary } from './wallet.models';
import { WalletStorageService } from './wallet-storage.service';
import { RealMask } from './real-mask';
import { createId } from './id-generator';

type SectionKey = 'income' | 'fixed' | 'variable' | 'saving';

interface MonthOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-root',
  imports: [CurrencyPipe, DatePipe, NgClass, ReactiveFormsModule, RealMask],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly formBuilder = inject(FormBuilder);
  private readonly walletStorage = inject(WalletStorageService);
  private readonly swUpdate = inject(SwUpdate, { optional: true });

  readonly appVersion = '2.1.0';
  readonly currentMonth = signal(this.getCurrentMonth());
  readonly monthPickerOpen = signal(false);
  readonly viewedYear = signal(Number(this.currentMonth().slice(0, 4)));
  readonly backupHelpOpen = signal(false);
  readonly reportOpen = signal(false);
  readonly importMessage = signal('');
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

  readonly summary = computed<WalletSummary>(() => {
    const monthEntries = this.selectedMonthEntries();
    const income = this.sumByKind(monthEntries, 'income');
    const fixedExpenses = this.sumByKind(monthEntries, 'fixed-expense');
    const variableExpenses = this.sumByKind(monthEntries, 'variable-expense');
    const savings = this.sumByKind(monthEntries, 'saving');

    return {
      income,
      fixedExpenses,
      variableExpenses,
      savings,
      balance: income - fixedExpenses - variableExpenses - savings,
    };
  });

  readonly visibleLists = signal({
    income: false,
    fixed: false,
    variable: false,
    saving: false,
  });

  readonly selectedMonthLabel = computed(() => this.formatMonthLabel(this.currentMonth()));

  readonly monthOptions = computed<MonthOption[]>(() =>
    Array.from({ length: 12 }, (_, index) => {
      const value = `${this.viewedYear()}-${String(index + 1).padStart(2, '0')}`;

      return {
        label: this.formatMonthName(index),
        value,
      };
    }),
  );

  readonly reportText = computed(() => this.buildReport());

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
    this.addSimpleEntry('saving', this.savingForm);
  }

  addVariableExpense(): void {
    if (this.variableExpenseForm.invalid) {
      this.variableExpenseForm.markAllAsTouched();
      return;
    }

    const { description, value, isInstallment, installments } =
      this.variableExpenseForm.getRawValue();
    const totalInstallments = isInstallment ? installments || 1 : 1;
    const groupId = createId();
    const installmentValue = Number(((value ?? 0) / totalInstallments).toFixed(2));
    const entries = Array.from({ length: totalInstallments }, (_, index) => ({
      kind: 'variable-expense' as const,
      description:
        totalInstallments > 1
          ? `${description} Parc.:${index + 1}/${totalInstallments}`
          : (description ?? ''),
      value: installmentValue,
      month: this.addMonths(this.currentMonth(), index),
      installment:
        totalInstallments > 1
          ? { groupId, current: index + 1, total: totalInstallments }
          : undefined,
    }));

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

  togglePaidStatus(entry: WalletEntry): void {
    this.walletStorage.togglePaid(entry.id, this.currentMonth());
  }

  isEntryPaid(entry: WalletEntry): boolean {
    if (entry.kind === 'fixed-expense') {
      return Boolean(entry.paidMonths?.[this.currentMonth()]);
    }

    return Boolean(entry.paid);
  }

  exportBackup(): void {
    const backup = {
      app: 'sattva-financas',
      version: 1,
      exportedAt: new Date().toISOString(),
      entries: this.entries(),
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `sattva-backup-${this.getCurrentMonth()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async importBackup(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      return;
    }

    try {
      const backup = JSON.parse(await file.text()) as { entries?: WalletEntry[] } | WalletEntry[];
      const entries = Array.isArray(backup) ? backup : backup.entries;

      if (!Array.isArray(entries)) {
        throw new Error('Arquivo invalido.');
      }

      this.walletStorage.replaceAll(entries.map((entry) => this.normalizeBackupEntry(entry)));
      this.importMessage.set('Backup importado com sucesso.');
    } catch {
      this.importMessage.set('Nao foi possivel importar este arquivo.');
    } finally {
      input.value = '';
    }
  }

  async copyReport(): Promise<void> {
    await navigator.clipboard.writeText(this.reportText());
  }

  printReport(): void {
    window.print();
  }

  updateCurrentMonth(value: string): void {
    this.currentMonth.set(value);
    this.viewedYear.set(Number(value.slice(0, 4)));
    this.monthPickerOpen.set(false);
  }

  toggleMonthPicker(): void {
    this.monthPickerOpen.update((isOpen) => !isOpen);
  }

  changeYear(offset: number): void {
    this.viewedYear.update((year) => year + offset);
  }

  toggleList(section: SectionKey): void {
    this.visibleLists.update((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  entriesByKind(kind: TransactionKind): WalletEntry[] {
    return this.selectedMonthEntries().filter((entry) => entry.kind === kind);
  }

  openBackupHelp(): void {
    this.backupHelpOpen.set(true);
  }

  openReport(): void {
    this.reportOpen.set(true);
  }

  closeModals(): void {
    this.backupHelpOpen.set(false);
    this.reportOpen.set(false);
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

  private getCurrentMonth(): string {
    return new Date().toISOString().slice(0, 7);
  }

  private addMonths(month: string, offset: number): string {
    const date = new Date(`${month}-01T00:00:00`);
    date.setMonth(date.getMonth() + offset);
    return date.toISOString().slice(0, 7);
  }

  private formatMonthLabel(month: string): string {
    const date = new Date(`${month}-01T00:00:00`);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
  }

  private formatMonthName(monthIndex: number): string {
    const date = new Date(this.viewedYear(), monthIndex, 1);
    return new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(date);
  }

  private buildReport(): string {
    const summary = this.summary();
    const fixedEntries = this.entriesByKind('fixed-expense');
    const variableEntries = this.entries()
      .filter((entry) => entry.kind === 'variable-expense')
      .sort((a, b) => a.month.localeCompare(b.month) || a.createdAt.localeCompare(b.createdAt));
    const savingEntries = this.entries()
      .filter((entry) => entry.kind === 'saving')
      .sort((a, b) => a.month.localeCompare(b.month) || a.createdAt.localeCompare(b.createdAt));
    const variableMonths = this.groupByMonth(variableEntries);
    const savingMonths = this.groupByMonth(savingEntries);
    const lines = [
      `Resumo - ${this.selectedMonthLabel()}`,
      '├── Saldo',
      `|   └── ${this.formatCurrency(summary.balance)}`,
      '|',
      '├── Entradas',
      `|   └── ${this.formatCurrency(summary.income)}`,
      '|',
      '├── Gasto Fixo',
      `|   ├── Total: ${this.formatCurrency(summary.fixedExpenses)}`,
      ...this.formatEntryLines(fixedEntries, '|   '),
      '|',
      '├── Gasto variavel',
      ...this.formatMonthGroups(variableMonths, '|   '),
      '|',
      '└── Cofrinho',
      ...this.formatMonthGroups(savingMonths, '    '),
    ];

    return lines.join('\n');
  }

  private formatMonthGroups(groups: Map<string, WalletEntry[]>, prefix: string): string[] {
    if (groups.size === 0) {
      return [`${prefix}└── Nenhum lancamento`];
    }

    return Array.from(groups.entries()).flatMap(([month, entries], monthIndex, allMonths) => {
      const isLastMonth = monthIndex === allMonths.length - 1;
      const monthBranch = isLastMonth ? '└──' : '├──';
      const childPrefix = `${prefix}${isLastMonth ? '    ' : '|   '}`;
      const total = entries.reduce((sum, entry) => sum + entry.value, 0);

      return [
        `${prefix}${monthBranch} ${this.formatMonthLabel(month)}`,
        `${childPrefix}├── Total: ${this.formatCurrency(total)}`,
        ...this.formatEntryLines(entries, childPrefix),
      ];
    });
  }

  private formatEntryLines(entries: WalletEntry[], prefix: string): string[] {
    if (entries.length === 0) {
      return [`${prefix}└── Nenhum lancamento`];
    }

    return entries.map((entry, index) => {
      const branch = index === entries.length - 1 ? '└──' : '├──';
      return `${prefix}${branch} ${entry.description}: ${this.formatCurrency(entry.value)}`;
    });
  }

  private groupByMonth(entries: WalletEntry[]): Map<string, WalletEntry[]> {
    return entries.reduce((groups, entry) => {
      const entriesForMonth = groups.get(entry.month) ?? [];
      groups.set(entry.month, [...entriesForMonth, entry]);
      return groups;
    }, new Map<string, WalletEntry[]>());
  }

  private formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  }

  private normalizeBackupEntry(entry: WalletEntry): WalletEntry {
    const kind = this.isTransactionKind(entry.kind) ? entry.kind : 'variable-expense';

    return {
      id: entry.id || createId(),
      kind,
      description: String(entry.description ?? ''),
      value: Number(entry.value ?? 0),
      month: String(entry.month ?? this.getCurrentMonth()),
      createdAt: String(entry.createdAt ?? new Date().toISOString()),
      paid: kind === 'variable-expense' ? Boolean(entry.paid) : undefined,
      paidMonths:
        kind === 'fixed-expense'
          ? (entry.paidMonths ?? (entry.paid ? { [entry.month]: true } : {}))
          : undefined,
      deletedFromMonth: kind === 'fixed-expense' ? entry.deletedFromMonth : undefined,
      installment: entry.installment,
    };
  }

  private isTransactionKind(kind: string): kind is TransactionKind {
    return ['income', 'fixed-expense', 'variable-expense', 'saving'].includes(kind);
  }

  private supportsPaidStatus(kind: TransactionKind): boolean {
    return kind === 'fixed-expense' || kind === 'variable-expense';
  }
}
