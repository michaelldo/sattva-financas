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
import { buildInstallments, remainingAfterInstallment } from './core/utils/installments';
import { groupByKind, isEntryVisibleInMonth, summarize, sumUnpaid } from './core/utils/entry.utils';
import { TransactionKind, WalletEntry, WalletSummary } from './core/models/wallet.models';
import { WalletStorageService } from './core/services/wallet-storage.service';
import { createId } from './core/utils/id-generator';
import { EntryCard } from './features/entry-card/entry-card';
import { MonthPicker } from './features/month-picker/month-picker';
import { ToastContainer } from './shared/components/toast-container/toast-container';
import { ToastService } from './core/services/toast.service';
import { ReportDialog } from './features/report-dialog/report-dialog';
import { EntryForm, EntryFormValue } from './features/entry-form/entry-form';
import { EditEntryDialog } from './features/edit-entry-dialog/edit-entry-dialog';
import { SideMenu } from './features/side-menu/side-menu';

@Component({
  selector: 'app-root',
  imports: [
    CurrencyPipe,
    DatePipe,
    EntryCard,
    MonthPicker,
    SideMenu,
    ToastContainer,
    ReportDialog,
    EntryForm,
    EditEntryDialog,
    SideMenu,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly walletStorage = inject(WalletStorageService);
  private readonly swUpdate = inject(SwUpdate, { optional: true });
  private readonly toast = inject(ToastService);

  protected readonly Kind = TransactionKind;

  readonly currentMonth = signal(getCurrentMonth());
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
}
