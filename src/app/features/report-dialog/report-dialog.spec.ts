import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportDialog } from './report-dialog';
import { TransactionKind, WalletEntry } from '../../core/models/wallet.models';
import { createEntry } from '../../core/utils/entry.utils';

@Component({
  imports: [ReportDialog],
  template: `<app-report-dialog [(open)]="open" [entries]="entries" [initialMonth]="month" />`,
})
class HostComponent {
  readonly open = signal(true);
  readonly month = '2026-03';
  readonly entries: WalletEntry[] = [
    createEntry({
      kind: TransactionKind.Income,
      description: 'Salário',
      value: 2500,
      month: '2026-01',
    }),
  ];
}

describe('ReportDialog', () => {
  let fixture: ComponentFixture<HostComponent>;
  let dialog: ReportDialog;
  let element: HTMLElement;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    element = fixture.nativeElement;
    dialog = fixture.debugElement.children[0].componentInstance;
  });

  it('começa no mês recebido e aceita um período', () => {
    expect(dialog.text()).toContain('Relatório - março de 2026');

    dialog.setFrom('2026-01');
    expect(dialog.text()).toContain('Relatório - janeiro de 2026 a março de 2026');
    expect(dialog.text()).toContain('Salário');
    expect(dialog.text()).toContain('Total do período');
  });

  it('o período nunca fica invertido', () => {
    // início depois do fim: o fim acompanha
    dialog.setFrom('2026-05');
    expect(dialog.to()).toBe('2026-05');

    // fim antes do início: o início acompanha
    dialog.setTo('2026-02');
    expect(dialog.from()).toBe('2026-02');
  });

  it('limita o período a 36 meses', () => {
    dialog.setFrom('2020-01');
    dialog.setTo('2026-02');

    expect(dialog.rangeError()).toBe('Escolha um período de até 36 meses.');
    expect(dialog.text()).toBe('');
  });

  it('escolhe o início pelo seletor de mês', async () => {
    const [fromPicker] = element.querySelectorAll<HTMLElement>('.report-range app-month-picker');
    fromPicker.querySelector<HTMLButtonElement>('.month-trigger')!.click();
    await fixture.whenStable();

    const january = Array.from(
      fromPicker.querySelectorAll<HTMLButtonElement>('.month-grid button'),
    ).find((button) => button.textContent?.trim() === 'janeiro')!;
    january.click();
    await fixture.whenStable();

    expect(dialog.from()).toBe('2026-01');
    expect(element.querySelector('textarea')?.value).toContain('janeiro de 2026 a março de 2026');
  });
});
