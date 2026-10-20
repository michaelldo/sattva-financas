import { ChangeDetectionStrategy, Component, inject, input, output } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MAX_DESCRIPTION_LENGTH } from '../../core/utils/entry-parser';
import {
  DESCRIPTION_VALIDATORS,
  INSTALLMENTS_VALIDATORS,
  MAX_INSTALLMENTS,
  VALUE_VALIDATORS,
} from '../../shared/forms/entry-validators';
import { RealMask } from '../../shared/directives/real-mask';

export interface EntryFormValue {
  description: string;
  value: number;
  installments: number;
}

@Component({
  selector: 'app-entry-form',
  imports: [ReactiveFormsModule, RealMask],
  templateUrl: './entry-form.html',
  styleUrl: './entry-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EntryForm {
  readonly placeholder = input.required<string>();
  readonly allowInstallments = input(false);
  readonly submitted = output<EntryFormValue>();

  protected readonly maxInstallments = MAX_INSTALLMENTS;
  protected readonly maxDescriptionLength = MAX_DESCRIPTION_LENGTH;

  readonly form = inject(FormBuilder).nonNullable.group({
    description: ['', DESCRIPTION_VALIDATORS],
    value: [null as number | null, VALUE_VALIDATORS],
    isInstallment: [false],
    installments: [1, INSTALLMENTS_VALIDATORS],
  });

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { description, value, isInstallment, installments } = this.form.getRawValue();
    this.submitted.emit({
      description: description.trim(),
      value: Number(value),
      installments: this.allowInstallments() && isInstallment ? installments : 1,
    });
    this.form.reset();
  }
}
