import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RealMask } from '../../shared/directives/real-mask';
import { DatePipe } from '@angular/common';
import { Modal } from '../../shared/components/modal/modal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { WalletStorageService } from '../../core/services/wallet-storage.service';
import { TransactionKind, WalletEntry } from '../../core/models/wallet.models';
import { MonthKey } from '../../core/utils/month.utils';
import {
  DESCRIPTION_VALIDATORS,
  INSTALLMENTS_VALIDATORS,
  MAX_INSTALLMENTS,
  VALUE_VALIDATORS,
} from '../../shared/forms/entry-validators';
import { MAX_DESCRIPTION_LENGTH } from '../../core/utils/entry-parser';
import { stripInstallmentSuffix } from '../../core/utils/installments';
import { sumValues } from '../../core/utils/entry.utils';

@Component({
  selector: 'app-edit-entry-dialog',
  imports: [Modal, ReactiveFormsModule, RealMask, DatePipe],
  templateUrl: './edit-entry-dialog.html',
  styleUrl: './edit-entry-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditEntryDialog {
  private readonly storage = inject(WalletStorageService);

  readonly entry = input.required<WalletEntry>();
  readonly month = input.required<MonthKey>();
  readonly closed = output<void>();

  protected readonly maxInstallments = MAX_INSTALLMENTS;
  protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;

  readonly form = inject(FormBuilder).nonNullable.group({
    description: ['', DESCRIPTION_VALIDATORS],
    value: [null as number | null, VALUE_VALIDATORS],
    installments: [1, INSTALLMENTS_VALIDATORS],
  });

  readonly installment = computed(() => {
    const entry = this.entry();
    return entry.kind === TransactionKind.VariableExpense && entry.installment
      ? entry.installment
      : null;
  });

  readonly isFixedExpense = computed(() => this.entry().kind === TransactionKind.FixedExpense);

  constructor() {
    effect(() => this.fillForm(this.entry()));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const entry = this.entry();
    const raw = this.form.getRawValue();
    const description = raw.description.trim();
    const value = Number(raw.value);

    if (entry.kind === TransactionKind.VariableExpense && entry.installment) {
      this.storage.editInstallmentGroup(entry.installment.groupId, {
        description,
        total: value,
        installments: raw.installments,
      });
    } else if (entry.kind === TransactionKind.FixedExpense) {
      this.storage.editFixedFromMonth(entry.id, this.month(), { description, value });
    } else {
      this.storage.update(entry.id, { description, value });
    }

    this.closed.emit();
  }

  private fillForm(entry: WalletEntry): void {
    if (entry.kind === TransactionKind.VariableExpense && entry.installment) {
      const { groupId, total } = entry.installment;
      const group = this.storage
        .entries()
        .filter(
          (item) =>
            item.kind === TransactionKind.VariableExpense && item.installment?.groupId === groupId,
        );

      this.form.reset({
        description: stripInstallmentSuffix(entry.description),
        value: sumValues(group),
        installments: total,
      });
      return;
    }

    this.form.reset({ description: entry.description, value: entry.value, installments: 1 });
  }
}
