import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EditEntryDialog } from './edit-entry-dialog';
import { TransactionKind, WalletEntry } from '../../core/models/wallet.models';
import { WalletStorageService } from '../../core/services/wallet-storage.service';
import { buildInstallments } from '../../core/utils/installments';

@Component({
  imports: [EditEntryDialog],
  template: `@if (entry(); as current) {
    <app-edit-entry-dialog [entry]="current" [month]="month()" (closed)="entry.set(null)" />
  }`,
})
class HostComponent {
  readonly entry = signal<WalletEntry | null>(null);
  readonly month = signal('2026-01');
}

describe('EditEntryDialog', () => {
  let storage: WalletStorageService;

  beforeEach(() => {
    localStorage.clear();
    storage = TestBed.inject(WalletStorageService);
  });

  /** Abre o modal para o lançamento e devolve o componente de edição. */
  async function open(entry: WalletEntry, month = '2026-01') {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.month.set(month);
    fixture.componentInstance.entry.set(entry);
    await fixture.whenStable();
    const dialog: EditEntryDialog = fixture.debugElement.query(
      (node) => node.componentInstance instanceof EditEntryDialog,
    ).componentInstance;
    return { fixture, dialog };
  }

  it('preenche, salva e fecha', async () => {
    storage.add({
      kind: TransactionKind.Income,
      description: 'Salario',
      value: 2500,
      month: '2026-01',
    });
    const { fixture, dialog } = await open(storage.entries()[0]);

    expect(dialog.form.getRawValue()).toMatchObject({ description: 'Salario', value: 2500 });
    const input = fixture.nativeElement.querySelector('[formControlName="value"]');
    expect(input.value).toBe('2.500,00'); // já formatado pela máscara

    dialog.form.patchValue({ description: 'Salário', value: 2800 });
    dialog.save();
    await fixture.whenStable();

    expect(storage.entries()[0]).toMatchObject({ description: 'Salário', value: 2800 });
    expect(fixture.componentInstance.entry()).toBeNull();
  });

  it('não salva com valor inválido', async () => {
    storage.add({
      kind: TransactionKind.Income,
      description: 'Salario',
      value: 2500,
      month: '2026-01',
    });
    const { fixture, dialog } = await open(storage.entries()[0]);

    dialog.form.patchValue({ value: null });
    dialog.save();

    expect(storage.entries()[0].value).toBe(2500);
    expect(fixture.componentInstance.entry()).not.toBeNull();
  });

  it('parcela: edita a compra inteira (valor total e quantidade)', async () => {
    storage.addMany(
      buildInstallments({
        description: 'Notebook',
        total: 3000,
        count: 3,
        startMonth: '2026-01',
        groupId: 'g1',
      }),
    );
    const { dialog } = await open(storage.entries()[0]);

    expect(dialog.form.getRawValue()).toEqual({
      description: 'Notebook',
      value: 3000,
      installments: 3,
    });

    dialog.form.patchValue({ value: 2000, installments: 4 });
    dialog.save();

    expect(storage.entries().map((entry) => entry.value)).toEqual([500, 500, 500, 500]);
  });

  it('gasto fixo: a edição vale do mês da tela em diante', async () => {
    storage.add({
      kind: TransactionKind.FixedExpense,
      description: 'Aluguel',
      value: 1000,
      month: '2026-01',
    });
    const { dialog } = await open(storage.entries()[0], '2026-03');

    dialog.form.patchValue({ value: 1200 });
    dialog.save();

    // antigo encerrado em março + continuação a partir de março
    expect(storage.entries().map((entry) => [entry.month, entry.value])).toEqual([
      ['2026-01', 1000],
      ['2026-03', 1200],
    ]);
  });
});
